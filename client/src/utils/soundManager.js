/**
 * UI Sound Manager — Web Audio API Synthesized Interaction Feedback & Runtime Diagnostics
 *
 * Implements subtle, restrained sound feedback inspired by polished UI designs.
 * - Sound is disabled by default until the user explicitly opts in.
 * - Preferences persisted to localStorage under 'auctionx_ui_sounds_enabled'.
 * - Autoplay compliant (AudioContext initialized/resumed on user gesture).
 * - Synthesized via Web Audio API (zero external assets, low latency, lightweight).
 * - Throttled hover events to prevent audio spam across dense product grids.
 * - Includes dedicated Test Sound tone and comprehensive runtime diagnostics.
 */

const STORAGE_KEY = "auctionx_ui_sounds_enabled";

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.lastHoverTime = 0;
    this.lastClickTime = 0;
    this.hoverThrottleMs = 60; // Minimum interval between hover sounds
    this.clickDedupeMs = 35; // Prevents duplicate click sounds from bubbling
    this.listeners = new Set();
    this.diagnosticListeners = new Set();
    this.unlockListenerBound = false;
    this.delegationBound = false;
    this.lastHoveredElement = null;
    this.lastError = null;
    this.lastTestResult = null;
    this.eventLogs = [];

    // Default disabled
    this.enabled = false;
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.enabled = saved === "true";
      } catch (err) {
        this.enabled = false;
        this.logEvent("STORAGE_READ_ERROR", { message: err.message });
      }

      // If user had previously enabled sounds, register a one-time gesture unlock
      if (this.enabled) {
        this.bindGestureUnlock();
      }

      // Automatically initialize global interaction delegation across all frontend elements
      this.initGlobalDelegation();
    }

    this.logEvent("MANAGER_INITIALIZED", {
      enabled: this.enabled,
      webAudioSupported: typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext),
    });
  }

  logEvent(type, data = {}) {
    const entry = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      type,
      contextState: this.ctx ? this.ctx.state : "uninitialized",
      ...data,
    };
    this.eventLogs.push(entry);
    if (this.eventLogs.length > 30) {
      this.eventLogs.shift();
    }
    this.notifyDiagnostics();
  }

  /**
   * Registers a one-time user gesture listener to unlock AudioContext if enabled from previous session.
   */
  bindGestureUnlock() {
    if (typeof window === "undefined" || this.unlockListenerBound) return;
    this.unlockListenerBound = true;

    const unlock = () => {
      if (this.enabled) {
        this.unlockAudio();
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
  }

  /**
   * Initializes AudioContext and master gain node lazily.
   */
  initContext() {
    if (typeof window === "undefined") return null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        this.lastError = "Web Audio API is not supported in this browser";
        this.logEvent("AUDIO_UNSUPPORTED", { error: this.lastError });
        return null;
      }

      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.logEvent("CONTEXT_CREATED", {
          state: this.ctx.state,
          sampleRate: this.ctx.sampleRate,
          maxChannels: this.ctx.destination?.maxChannelCount,
        });

        // Listen for state transitions
        this.ctx.onstatechange = () => {
          this.logEvent("CONTEXT_STATE_CHANGED", { state: this.ctx?.state });
        };
      }

      return this.ctx;
    } catch (err) {
      this.lastError = err.message || "Failed to initialize AudioContext";
      this.logEvent("CONTEXT_INIT_ERROR", { error: this.lastError });
      return null;
    }
  }

  /**
   * Explicitly resumes the audio context on user interaction.
   */
  async unlockAudio() {
    const ctx = this.initContext();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
        this.logEvent("CONTEXT_RESUMED", { state: ctx.state });
      } catch (err) {
        this.lastError = err.message || "Failed to resume AudioContext";
        this.logEvent("RESUME_REJECTED", { error: this.lastError });
      }
    }
    return ctx;
  }

  /**
   * Ensures the AudioContext is running before executing a synthesized sound callback.
   * If the context is suspended, resumes it and executes playback once running.
   */
  ensureRunningContext(callback) {
    if (!this.enabled) {
      this.logEvent("SOUND_DROPPED_DISABLED");
      return;
    }

    const ctx = this.initContext();
    if (!ctx) {
      this.logEvent("SOUND_DROPPED_NO_CONTEXT");
      return;
    }

    if (ctx.state === "running") {
      callback(ctx, this.masterGain);
    } else if (ctx.state === "suspended") {
      this.logEvent("RESUME_ATTEMPT_ON_GESTURE");
      ctx
        .resume()
        .then(() => {
          this.logEvent("CONTEXT_RESUMED_ON_GESTURE", { state: ctx.state });
          if (ctx.state === "running") {
            callback(ctx, this.masterGain);
          }
        })
        .catch((err) => {
          this.lastError = err.message || "Failed to resume suspended context";
          this.logEvent("RESUME_FAILED_ON_GESTURE", { error: this.lastError });
        });
    } else {
      this.logEvent("SOUND_DROPPED_UNEXPECTED_STATE", { state: ctx.state });
    }
  }

  isSoundEnabled() {
    return this.enabled;
  }

  setSoundEnabled(enable) {
    this.enabled = Boolean(enable);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, this.enabled ? "true" : "false");
        this.logEvent("PREFERENCE_PERSISTED", { enabled: this.enabled });
      } catch (err) {
        this.logEvent("STORAGE_WRITE_ERROR", { message: err.message });
      }
    }

    if (this.enabled) {
      this.bindGestureUnlock();
      this.unlockAudio().then(() => {
        // Immediate audible feedback confirming sounds are active
        this.playActivation();
      });
    }

    this.notify();
    this.notifyDiagnostics();
  }

  toggleSound() {
    this.setSoundEnabled(!this.enabled);
    return this.enabled;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.enabled);
      } catch {}
    });
  }

  subscribeDiagnostics(listener) {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  notifyDiagnostics() {
    this.diagnosticListeners.forEach((fn) => {
      try {
        fn(this.getDiagnostics());
      } catch {}
    });
  }

  getDiagnostics() {
    const AudioCtx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    return {
      webAudioSupported: Boolean(AudioCtx),
      contextExists: Boolean(this.ctx),
      contextState: this.ctx ? this.ctx.state : "uninitialized",
      sampleRate: this.ctx ? this.ctx.sampleRate : null,
      destinationMaxChannels: this.ctx?.destination?.maxChannelCount ?? null,
      baseLatency: this.ctx?.baseLatency ?? null,
      outputLatency: this.ctx?.outputLatency ?? null,
      currentTime: this.ctx ? Number(this.ctx.currentTime.toFixed(3)) : null,
      isSoundEnabled: this.enabled,
      storageValue: typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
      lastError: this.lastError,
      lastTestResult: this.lastTestResult,
      eventLogs: [...this.eventLogs],
    };
  }

  /**
   * Explicit Test Sound Tone (500–800 ms).
   * Runs directly from the user's click handler.
   * Plays a 650 ms 440 Hz test tone with clear fade-in and fade-out.
   * Does NOT enable persistent UI sounds.
   * Returns a promise with complete diagnostic execution result.
   */
  async playTestTone() {
    this.logEvent("TEST_TONE_CLICKED");
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("Web Audio API is not supported in this browser");
      }

      // Initialize or resume context directly inside the user's click gesture stack
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === "suspended") {
        this.logEvent("TEST_TONE_RESUMING_CONTEXT");
        await this.ctx.resume();
      }

      if (this.ctx.state !== "running") {
        throw new Error(`AudioContext state is '${this.ctx.state}', could not transition to 'running'`);
      }

      const t = this.ctx.currentTime;
      const duration = 0.65; // 650 ms (fits 500-800 ms spec)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Clear 440 Hz standard concert pitch
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, t);

      // Smooth envelope: 50ms fade-in to 0.35, sustain, 150ms fade-out to 0
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
      gain.gain.setValueAtTime(0.35, t + duration - 0.15);
      gain.gain.linearRampToValueAtTime(0.0001, t + duration);

      // Connect both directly to destination and masterGain for safety
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.start(t);
      osc.stop(t + duration + 0.02);

      const result = {
        success: true,
        message: "Test tone scheduled successfully",
        frequency: 440,
        durationMs: Math.round(duration * 1000),
        peakGain: 0.35,
        contextState: this.ctx.state,
        sampleRate: this.ctx.sampleRate,
        maxChannels: this.ctx.destination?.maxChannelCount,
        scheduledAt: Number(t.toFixed(3)),
      };

      this.lastTestResult = result;
      this.lastError = null;
      this.logEvent("TEST_TONE_SCHEDULED", result);
      return result;
    } catch (err) {
      const errorResult = {
        success: false,
        error: err.message || String(err),
        stack: err.stack,
        contextState: this.ctx ? this.ctx.state : "uninitialized",
      };
      this.lastTestResult = errorResult;
      this.lastError = err.message;
      this.logEvent("TEST_TONE_FAILED", errorResult);
      return errorResult;
    }
  }

  /**
   * eDEX-UI-inspired tactile "tic" on hover / pointer enter.
   * Micro-contact impulse: dry, crisp, 18ms downward sweep (1400Hz -> 850Hz).
   * Non-fatiguing, zero musical chime, rapid 1.5ms attack to 0.085 gain.
   * Throttled to 60ms; ignores touch devices and respects prefers-reduced-motion.
   */
  playHover() {
    if (!this.enabled) return;

    // Hover is not an allowable gesture for resuming/starting AudioContext under Chrome's Autoplay Policy.
    // Only synthesize hover if context is already initialized and actively running.
    if (!this.ctx || this.ctx.state !== "running") {
      return;
    }

    // Respect user reduced-motion preference if active
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const now = Date.now();
    if (now - this.lastHoverTime < this.hoverThrottleMs) {
      return;
    }
    this.lastHoverTime = now;

    this.ensureRunningContext((ctx, master) => {
      try {
        const t = ctx.currentTime;
        const duration = 0.018; // 18 ms ultra-short tactile micro-contact
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // High detail mechanical contact chirp
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, t);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(850, t + duration);
        } else {
          osc.frequency.linearRampToValueAtTime(850, t + duration);
        }

        // Fast 1.5ms attack to 0.085 gain, exponential decay to zero
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.085, t + 0.0015);
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        } else {
          gain.gain.linearRampToValueAtTime(0.0001, t + duration);
        }

        osc.connect(gain);
        gain.connect(master || ctx.destination);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };

        osc.start(t);
        osc.stop(t + duration + 0.003);
        this.logEvent("HOVER_TIC_PLAYED", { scheduledAt: t });
      } catch (err) {
        this.lastError = err.message;
        this.logEvent("HOVER_ERROR", { error: err.message });
      }
    });
  }

  /**
   * eDEX-UI-inspired tactile "tac" on activation / click.
   * Dual-layer mechanical switch actuation (~34ms total):
   *  - Layer 1: 10ms high transient contact snap (1200Hz -> 420Hz, gain 0.10)
   *  - Layer 2: 32ms firm switch body pop (260Hz -> 110Hz triangle wave, gain 0.22)
   * Deduplicated within 35ms to prevent double sounds from bubbling or nested cards.
   */
  playClick() {
    if (!this.enabled) return;

    // Deduplication window: Prevent nested elements or bubbling from playing multiple clicks
    const now = Date.now();
    if (now - this.lastClickTime < this.clickDedupeMs) {
      return;
    }
    this.lastClickTime = now;

    this.ensureRunningContext((ctx, master) => {
      try {
        const t = ctx.currentTime;
        const clickDuration = 0.034;

        // Layer 1: Transient contact snap (high frequency click)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = "sine";
        snapOsc.frequency.setValueAtTime(1200, t);
        if (snapOsc.frequency.exponentialRampToValueAtTime) {
          snapOsc.frequency.exponentialRampToValueAtTime(420, t + 0.010);
        } else {
          snapOsc.frequency.linearRampToValueAtTime(420, t + 0.010);
        }
        snapGain.gain.setValueAtTime(0.0001, t);
        snapGain.gain.linearRampToValueAtTime(0.10, t + 0.001);
        if (snapGain.gain.exponentialRampToValueAtTime) {
          snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.010);
        } else {
          snapGain.gain.linearRampToValueAtTime(0.0001, t + 0.010);
        }
        snapOsc.connect(snapGain);
        snapGain.connect(master || ctx.destination);
        snapOsc.onended = () => {
          try {
            snapOsc.disconnect();
            snapGain.disconnect();
          } catch {}
        };
        snapOsc.start(t);
        snapOsc.stop(t + 0.012);

        // Layer 2: Mechanical switch body pop (warm tactile body)
        const bodyOsc = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        bodyOsc.type = "triangle";
        bodyOsc.frequency.setValueAtTime(260, t);
        if (bodyOsc.frequency.exponentialRampToValueAtTime) {
          bodyOsc.frequency.exponentialRampToValueAtTime(110, t + clickDuration);
        } else {
          bodyOsc.frequency.linearRampToValueAtTime(110, t + clickDuration);
        }
        bodyGain.gain.setValueAtTime(0.0001, t);
        bodyGain.gain.linearRampToValueAtTime(0.22, t + 0.002);
        if (bodyGain.gain.exponentialRampToValueAtTime) {
          bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + clickDuration);
        } else {
          bodyGain.gain.linearRampToValueAtTime(0.0001, t + clickDuration);
        }
        bodyOsc.connect(bodyGain);
        bodyGain.connect(master || ctx.destination);
        bodyOsc.onended = () => {
          try {
            bodyOsc.disconnect();
            bodyGain.disconnect();
          } catch {}
        };
        bodyOsc.start(t);
        bodyOsc.stop(t + clickDuration + 0.005);

        this.logEvent("CLICK_TAC_PLAYED", { scheduledAt: t });
      } catch (err) {
        this.lastError = err.message;
        this.logEvent("CLICK_ERROR", { error: err.message });
      }
    });
  }

  /**
   * Restrained, modern two-pip rising confirmation for success events.
   * Total duration ~68ms (non-musical, technical).
   */
  playSuccess() {
    if (!this.enabled) return;

    this.ensureRunningContext((ctx, master) => {
      try {
        const t = ctx.currentTime;
        const notes = [
          { freq: 523.25, offset: 0, dur: 0.028, gain: 0.14 },
          { freq: 783.99, offset: 0.032, dur: 0.036, gain: 0.15 },
        ];

        notes.forEach(({ freq, offset, dur, gain: noteGain }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = t + offset;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(noteGain, start + 0.003);
          if (gain.gain.exponentialRampToValueAtTime) {
            gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
          } else {
            gain.gain.linearRampToValueAtTime(0.0001, start + dur);
          }

          osc.connect(gain);
          gain.connect(master || ctx.destination);

          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {}
          };

          osc.start(start);
          osc.stop(start + dur + 0.005);
        });
        this.logEvent("SUCCESS_CHIME_PLAYED");
      } catch (err) {
        this.lastError = err.message;
        this.logEvent("SUCCESS_ERROR", { error: err.message });
      }
    });
  }

  /**
   * Plays activation tone when sound is turned on.
   */
  playActivation() {
    this.ensureRunningContext((ctx, master) => {
      try {
        const t = ctx.currentTime;
        const freqs = [440, 660];

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = t + idx * 0.04;
          const noteDuration = 0.04;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.16, start + 0.004);
          if (gain.gain.exponentialRampToValueAtTime) {
            gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);
          } else {
            gain.gain.linearRampToValueAtTime(0.0001, start + noteDuration);
          }

          osc.connect(gain);
          gain.connect(master || ctx.destination);

          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {}
          };

          osc.start(start);
          osc.stop(start + noteDuration + 0.005);
        });
        this.logEvent("ACTIVATION_CHIME_PLAYED");
      } catch (err) {
        this.lastError = err.message;
        this.logEvent("ACTIVATION_ERROR", { error: err.message });
      }
    });
  }

  /**
   * Restrained, low double-tap mechanical pulse for error/rejections.
   * Total duration ~62ms (dry, non-intrusive).
   */
  playError() {
    if (!this.enabled) return;

    this.ensureRunningContext((ctx, master) => {
      try {
        const t = ctx.currentTime;
        const notes = [
          { freq: 180, offset: 0, dur: 0.025, gain: 0.16 },
          { freq: 130, offset: 0.030, dur: 0.030, gain: 0.14 },
        ];

        notes.forEach(({ freq, offset, dur, gain: noteGain }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = t + offset;

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(noteGain, start + 0.003);
          if (gain.gain.exponentialRampToValueAtTime) {
            gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
          } else {
            gain.gain.linearRampToValueAtTime(0.0001, start + dur);
          }

          osc.connect(gain);
          gain.connect(master || ctx.destination);

          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {}
          };

          osc.start(start);
          osc.stop(start + dur + 0.005);
        });
        this.logEvent("ERROR_NUDGE_PLAYED");
      } catch (err) {
        this.lastError = err.message;
        this.logEvent("ERROR_PIPS_ERROR", { error: err.message });
      }
    });
  }

  /**
   * Restrained 22ms technical cue for tab switches or slide transitions.
   */
  playNav() {
    if (!this.enabled) return;

    this.ensureRunningContext((ctx, master) => {
      try {
        const t = ctx.currentTime;
        const duration = 0.022;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(680, t);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(450, t + duration);
        } else {
          osc.frequency.linearRampToValueAtTime(450, t + duration);
        }

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.002);
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        } else {
          gain.gain.linearRampToValueAtTime(0.0001, t + duration);
        }

        osc.connect(gain);
        gain.connect(master || ctx.destination);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };

        osc.start(t);
        osc.stop(t + duration + 0.003);
        this.logEvent("NAV_CUE_PLAYED");
      } catch (err) {
        this.lastError = err.message;
        this.logEvent("NAV_ERROR", { error: err.message });
      }
    });
  }

  /**
   * Global Interaction Delegation System
   * Provides 100% frontend UI sound coverage without manual handler duplication.
   * - Binds passive listeners on document for pointerover, pointerout, and click.
   * - Filters out touch pointer events so touch taps do not trigger hover sounds.
   * - Implements semantic boundaries: inner child triggers prevent parent duplicates.
   * - Binds keyboard focusin for accessible focus-visible spatial cues.
   * - Respects data-sound="none" and disabled states.
   */
  initGlobalDelegation() {
    if (typeof document === "undefined" || this.delegationBound) return;
    this.delegationBound = true;
    this.lastHoveredElement = null;

    // Pointerover: handles hover entry across all interactive elements
    document.addEventListener(
      "pointerover",
      (e) => {
        if (!this.enabled) return;
        // Ignore touch events to prevent tap-hover duplicate sounds on mobile
        if (e.pointerType === "touch") return;

        const target = e.target.closest?.(
          'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], input[type="submit"], input[type="button"], select, [data-sound-hover], [data-sound-interactive], [data-sound-click], .product-card, .clickable-card, .cursor-pointer'
        );

        if (!target) return;
        // Ignore elements explicitly marked data-sound="none"
        if (target.closest?.('[data-sound="none"]')) return;
        // Ignore disabled elements
        if (target.disabled || target.getAttribute?.("aria-disabled") === "true") return;

        // Prevent repeated triggers when moving between child nodes of same target
        if (this.lastHoveredElement === target || this.lastHoveredElement?.contains(target)) return;
        this.lastHoveredElement = target;

        this.playHover();
      },
      { passive: true }
    );

    document.addEventListener(
      "pointerout",
      (e) => {
        if (this.lastHoveredElement && (!e.relatedTarget || !this.lastHoveredElement.contains(e.relatedTarget))) {
          this.lastHoveredElement = null;
        }
      },
      { passive: true }
    );

    // Click: handles click activation across all interactive elements
    document.addEventListener(
      "click",
      (e) => {
        if (!this.enabled) return;
        // If an inner component already handled sound explicitly, do not duplicate
        if (e.__soundHandled) return;

        const target = e.target.closest?.(
          'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], input[type="submit"], input[type="button"], select, [data-sound-click], [data-sound-interactive], .product-card, .clickable-card, .cursor-pointer'
        );

        if (!target) return;
        if (target.closest?.('[data-sound="none"]')) return;
        if (target.disabled || target.getAttribute?.("aria-disabled") === "true") return;

        // Mark event so bubbling won't trigger duplicate sounds in outer wrappers
        e.__soundHandled = true;
        this.playClick();
      },
      { capture: false, passive: true }
    );

    // Keyboard navigation focus: trigger soft tic for focus-visible
    document.addEventListener(
      "focusin",
      (e) => {
        if (!this.enabled) return;
        const target = e.target.closest?.(
          'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [data-sound-interactive]'
        );
        if (!target) return;
        if (target.closest?.('[data-sound="none"]')) return;
        if (target.disabled || target.getAttribute?.("aria-disabled") === "true") return;

        // Only play if focused via keyboard (:focus-visible equivalent)
        try {
          if (target.matches?.(":focus-visible")) {
            this.playHover();
          }
        } catch {}
      },
      { passive: true }
    );
  }
}

export const soundManager = new SoundManager();
export default soundManager;
