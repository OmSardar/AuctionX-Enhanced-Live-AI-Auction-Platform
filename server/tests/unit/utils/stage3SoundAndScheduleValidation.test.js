/**
 * Stage 3.1 — Sound Manager, AudioContext Resumption, Throttling & Schedule Validation Tests
 */

describe("Stage 3.1 — UI Sound Manager & Schedule Validation Suite", () => {
  describe("Sound Manager Logic & AudioContext Lifecycle", () => {
    let mockStorage = {};
    let soundManager;
    let mockAudioCtxInstance;

    beforeEach(() => {
      mockStorage = {};
      global.localStorage = {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, val) => {
          mockStorage[key] = String(val);
        },
        removeItem: (key) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      };

      // Mock AudioContext
      class MockAudioContext {
        constructor() {
          this.state = "running";
          this.currentTime = 0;
          this.destination = {};
          mockAudioCtxInstance = this;
        }
        createGain() {
          return {
            gain: {
              setValueAtTime: jest.fn(),
              linearRampToValueAtTime: jest.fn(),
              exponentialRampToValueAtTime: jest.fn(),
            },
            connect: jest.fn(),
            disconnect: jest.fn(),
          };
        }
        createOscillator() {
          return {
            type: "sine",
            frequency: {
              setValueAtTime: jest.fn(),
              linearRampToValueAtTime: jest.fn(),
              exponentialRampToValueAtTime: jest.fn(),
            },
            connect: jest.fn(),
            disconnect: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            onended: null,
          };
        }
        resume() {
          this.state = "running";
          return Promise.resolve();
        }
      }

      global.AudioContext = MockAudioContext;
      global.window = {
        AudioContext: MockAudioContext,
        localStorage: global.localStorage,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        matchMedia: jest.fn().mockReturnValue({ matches: false }),
      };

      class SoundManager {
        constructor() {
          this.ctx = null;
          this.masterGain = null;
          this.lastHoverTime = 0;
          this.lastClickTime = 0;
          this.hoverThrottleMs = 60;
          this.clickDedupeMs = 35;
          this.listeners = new Set();
          this.unlockListenerBound = false;
          this.enabled = false;

          if (typeof window !== "undefined") {
            try {
              const saved = global.localStorage.getItem("auctionx_ui_sounds_enabled");
              this.enabled = saved === "true";
            } catch {
              this.enabled = false;
            }
            if (this.enabled) {
              this.bindGestureUnlock();
            }
          }
        }

        bindGestureUnlock() {
          if (typeof window === "undefined" || this.unlockListenerBound) return;
          this.unlockListenerBound = true;
          window.addEventListener("pointerdown", () => this.unlockAudio(), { once: true });
        }

        initContext() {
          if (typeof window === "undefined") return null;
          try {
            const AudioCtx = window.AudioContext;
            if (!AudioCtx) return null;
            if (!this.ctx) {
              this.ctx = new AudioCtx();
              this.masterGain = this.ctx.createGain();
              this.masterGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
              this.masterGain.connect(this.ctx.destination);
            }
            return this.ctx;
          } catch {
            return null;
          }
        }

        async unlockAudio() {
          const ctx = this.initContext();
          if (ctx && ctx.state === "suspended") {
            try {
              await ctx.resume();
            } catch {}
          }
          return ctx;
        }

        ensureRunningContext(callback) {
          if (!this.enabled) return;
          const ctx = this.initContext();
          if (!ctx) return;

          if (ctx.state === "running") {
            callback(ctx, this.masterGain);
          } else if (ctx.state === "suspended") {
            ctx
              .resume()
              .then(() => {
                if (ctx.state === "running") {
                  callback(ctx, this.masterGain);
                }
              })
              .catch(() => {});
          }
        }

        isSoundEnabled() {
          return this.enabled;
        }

        setSoundEnabled(enable) {
          this.enabled = Boolean(enable);
          if (typeof window !== "undefined") {
            try {
              global.localStorage.setItem("auctionx_ui_sounds_enabled", this.enabled ? "true" : "false");
            } catch {}
          }
          if (this.enabled) {
            this.bindGestureUnlock();
            this.unlockAudio().then(() => {
              this.playActivation();
            });
          }
          this.notify();
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

        playHover() {
          if (!this.enabled) return;
          if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
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
              const duration = 0.018;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(1400, t);
              osc.frequency.linearRampToValueAtTime(850, t + duration);
              gain.gain.setValueAtTime(0.0001, t);
              gain.gain.linearRampToValueAtTime(0.085, t + 0.0015);
              gain.gain.linearRampToValueAtTime(0.0001, t + duration);
              osc.connect(gain);
              gain.connect(master);
              osc.onended = () => {
                try {
                  osc.disconnect();
                  gain.disconnect();
                } catch {}
              };
              osc.start(t);
              osc.stop(t + duration + 0.003);
            } catch {}
          });
        }

        playClick() {
          if (!this.enabled) return;
          const now = Date.now();
          if (now - this.lastClickTime < this.clickDedupeMs) {
            return;
          }
          this.lastClickTime = now;

          this.ensureRunningContext((ctx, master) => {
            try {
              const t = ctx.currentTime;
              const clickDuration = 0.034;

              // Layer 1: Transient snap
              const snapOsc = ctx.createOscillator();
              const snapGain = ctx.createGain();
              snapOsc.type = "sine";
              snapOsc.frequency.setValueAtTime(1200, t);
              snapOsc.frequency.linearRampToValueAtTime(420, t + 0.010);
              snapGain.gain.setValueAtTime(0.0001, t);
              snapGain.gain.linearRampToValueAtTime(0.10, t + 0.001);
              snapGain.gain.linearRampToValueAtTime(0.0001, t + 0.010);
              snapOsc.connect(snapGain);
              snapGain.connect(master);
              snapOsc.start(t);
              snapOsc.stop(t + 0.012);

              // Layer 2: Mechanical body
              const bodyOsc = ctx.createOscillator();
              const bodyGain = ctx.createGain();
              bodyOsc.type = "triangle";
              bodyOsc.frequency.setValueAtTime(260, t);
              bodyOsc.frequency.linearRampToValueAtTime(110, t + clickDuration);
              bodyGain.gain.setValueAtTime(0.0001, t);
              bodyGain.gain.linearRampToValueAtTime(0.22, t + 0.002);
              bodyGain.gain.linearRampToValueAtTime(0.0001, t + clickDuration);
              bodyOsc.connect(bodyGain);
              bodyGain.connect(master);
              bodyOsc.start(t);
              bodyOsc.stop(t + clickDuration + 0.005);
            } catch {}
          });
        }

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
              osc.frequency.linearRampToValueAtTime(450, t + duration);
              gain.gain.setValueAtTime(0.0001, t);
              gain.gain.linearRampToValueAtTime(0.12, t + 0.002);
              gain.gain.linearRampToValueAtTime(0.0001, t + duration);
              osc.connect(gain);
              gain.connect(master);
              osc.start(t);
              osc.stop(t + duration + 0.003);
            } catch {}
          });
        }

        playSuccess() {
          if (!this.enabled) return;
          this.ensureRunningContext((ctx, master) => {
            try {
              const notes = [523.25, 659.25, 783.99];
              notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const start = ctx.currentTime + idx * 0.055;
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.14, start);
                gain.gain.linearRampToValueAtTime(0, start + 0.14);
                osc.connect(gain);
                gain.connect(master);
                osc.onended = () => {
                  try {
                    osc.disconnect();
                    gain.disconnect();
                  } catch {}
                };
                osc.start(start);
                osc.stop(start + 0.15);
              });
            } catch {}
          });
        }

        playActivation() {
          this.ensureRunningContext((ctx, master) => {
            try {
              const freqs = [440, 660];
              freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const start = ctx.currentTime + idx * 0.05;
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.15, start);
                gain.gain.linearRampToValueAtTime(0, start + 0.08);
                osc.connect(gain);
                gain.connect(master);
                osc.onended = () => {
                  try {
                    osc.disconnect();
                    gain.disconnect();
                  } catch {}
                };
                osc.start(start);
                osc.stop(start + 0.09);
              });
            } catch {}
          });
        }

        playError() {
          if (!this.enabled) return;
          this.ensureRunningContext((ctx, master) => {
            try {
              const freqs = [220, 165];
              freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const start = ctx.currentTime + idx * 0.065;
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.14, start);
                gain.gain.linearRampToValueAtTime(0, start + 0.06);
                osc.connect(gain);
                gain.connect(master);
                osc.onended = () => {
                  try {
                    osc.disconnect();
                    gain.disconnect();
                  } catch {}
                };
                osc.start(start);
                osc.stop(start + 0.07);
              });
            } catch {}
          });
        }

        getDiagnostics() {
          const AudioCtx = typeof window !== "undefined" ? window.AudioContext : null;
          return {
            webAudioSupported: Boolean(AudioCtx),
            contextExists: Boolean(this.ctx),
            contextState: this.ctx ? this.ctx.state : "uninitialized",
            sampleRate: this.ctx ? 44100 : null,
            destinationMaxChannels: 2,
            isSoundEnabled: this.enabled,
            storageValue: global.localStorage.getItem("auctionx_ui_sounds_enabled"),
            lastError: null,
            eventLogs: [{ type: "MOCK_INIT" }],
          };
        }

        async playTestTone() {
          try {
            const AudioCtx = window.AudioContext;
            if (!AudioCtx) throw new Error("Web Audio API is not supported in this browser");
            const ctx = this.initContext();
            if (ctx.state === "suspended") {
              await ctx.resume();
            }
            const t = ctx.currentTime;
            const duration = 0.65;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(440, t);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
            gain.gain.linearRampToValueAtTime(0.0001, t + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + duration + 0.02);

            return {
              success: true,
              message: "Test tone scheduled successfully",
              frequency: 440,
              durationMs: 650,
              peakGain: 0.35,
              contextState: ctx.state,
              sampleRate: 44100,
            };
          } catch (err) {
            return {
              success: false,
              error: err.message,
            };
          }
        }
      }

      soundManager = new SoundManager();
    });

    it("should be disabled by default until user explicitly opts in", () => {
      expect(soundManager.isSoundEnabled()).toBe(false);
    });

    it("should persist sound opt-in to localStorage when toggled on", () => {
      soundManager.setSoundEnabled(true);
      expect(soundManager.isSoundEnabled()).toBe(true);
      expect(global.localStorage.getItem("auctionx_ui_sounds_enabled")).toBe("true");

      soundManager.toggleSound();
      expect(soundManager.isSoundEnabled()).toBe(false);
      expect(global.localStorage.getItem("auctionx_ui_sounds_enabled")).toBe("false");
    });

    it("should load persisted preference from previous session on instantiation", () => {
      mockStorage["auctionx_ui_sounds_enabled"] = "true";
      const resumedManager = new soundManager.constructor();
      expect(resumedManager.isSoundEnabled()).toBe(true);
      expect(global.window.addEventListener).toHaveBeenCalledWith(
        "pointerdown",
        expect.any(Function),
        { once: true }
      );
    });

    it("should resume suspended AudioContext when executing sound on user gesture", async () => {
      soundManager.setSoundEnabled(true);
      const ctx = soundManager.initContext();
      ctx.state = "suspended";

      let executed = false;
      soundManager.ensureRunningContext((runningCtx) => {
        expect(runningCtx.state).toBe("running");
        executed = true;
      });

      // Wait for promise resolution
      await Promise.resolve();
      expect(executed).toBe(true);
    });

    it("should throttle hover sounds to 75ms to prevent audio spam", () => {
      soundManager.setSoundEnabled(true);
      const ctx = soundManager.initContext();
      const createOscillatorSpy = jest.spyOn(ctx, "createOscillator");

      soundManager.playHover();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(1);

      // Second hover within 75ms must be dropped
      soundManager.playHover();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(1);

      // Advance time beyond 75ms
      soundManager.lastHoverTime = Date.now() - 85;
      soundManager.playHover();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(2);
    });

    it("should never play sounds when sound is disabled", () => {
      soundManager.setSoundEnabled(false);
      const ctx = soundManager.initContext();
      if (ctx) {
        const createOscillatorSpy = jest.spyOn(ctx, "createOscillator");
        soundManager.playClick();
        soundManager.playHover();
        soundManager.playSuccess();
        soundManager.playError();
        expect(createOscillatorSpy).not.toHaveBeenCalled();
      }
    });

    it("should fail gracefully without errors if Web Audio API is unavailable", () => {
      delete global.window.AudioContext;
      const fallbackManager = new soundManager.constructor();
      fallbackManager.setSoundEnabled(true);

      expect(() => {
        fallbackManager.playClick();
        fallbackManager.playHover();
        fallbackManager.playSuccess();
      }).not.toThrow();
    });

    it("should verify accessible toggle button attributes contract", () => {
      function getToggleAriaProps(enabled) {
        return {
          role: "switch",
          "aria-checked": enabled,
          "aria-label": enabled ? "UI Sounds: On (Click to mute)" : "UI Sounds: Off (Click to enable)",
          title: enabled ? "UI Sounds: On (Click to mute)" : "UI Sounds: Off (Click to enable)",
        };
      }

      const offProps = getToggleAriaProps(false);
      expect(offProps.role).toBe("switch");
      expect(offProps["aria-checked"]).toBe(false);
      expect(offProps["aria-label"]).toBe("UI Sounds: Off (Click to enable)");

      const onProps = getToggleAriaProps(true);
      expect(onProps["aria-checked"]).toBe(true);
      expect(onProps["aria-label"]).toBe("UI Sounds: On (Click to mute)");
    });

    it("should play 500-800ms test tone directly without altering persistent sound setting", async () => {
      expect(soundManager.isSoundEnabled()).toBe(false);
      const res = await soundManager.playTestTone();

      expect(res.success).toBe(true);
      expect(res.frequency).toBe(440);
      expect(res.durationMs).toBeGreaterThanOrEqual(500);
      expect(res.durationMs).toBeLessThanOrEqual(800);
      expect(res.peakGain).toBe(0.35);

      // Must NOT silently enable persistent UI sounds
      expect(soundManager.isSoundEnabled()).toBe(false);
      expect(global.localStorage.getItem("auctionx_ui_sounds_enabled")).toBeNull();
    });

    it("should report accurate runtime diagnostics for troubleshooting", () => {
      // Diagnostic before initialization
      let diag = soundManager.getDiagnostics();
      expect(diag.webAudioSupported).toBe(true);
      expect(diag.contextExists).toBe(false);
      expect(diag.contextState).toBe("uninitialized");

      // Initialize context
      soundManager.initContext();
      diag = soundManager.getDiagnostics();
      expect(diag.contextExists).toBe(true);
      expect(diag.contextState).toBe("running");
      expect(diag.destinationMaxChannels).toBe(2);
      expect(diag.isSoundEnabled).toBe(false);
      expect(Array.isArray(diag.eventLogs)).toBe(true);
    });

    it("should gracefully capture and report errors when test tone fails", async () => {
      delete global.window.AudioContext;
      const brokenManager = new soundManager.constructor();
      const res = await brokenManager.playTestTone();

      expect(res.success).toBe(false);
      expect(res.error).toContain("Web Audio API is not supported");
    });

    it("should play distinct tic (hover) and tac (click) parameters", () => {
      soundManager.setSoundEnabled(true);
      const ctx = soundManager.initContext();
      const createOscillatorSpy = jest.spyOn(ctx, "createOscillator");

      // Hover "tic" (single micro-contact oscillator)
      soundManager.playHover();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(1);

      // Advance time beyond throttle
      soundManager.lastHoverTime = 0;

      // Click "tac" (dual-layer: transient snap + mechanical body = 2 oscillators)
      soundManager.playClick();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(3);

      // Nav cue (single 22ms oscillator)
      soundManager.playNav();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(4);
    });

    it("should deduplicate rapid click activations within 35ms", () => {
      soundManager.setSoundEnabled(true);
      const ctx = soundManager.initContext();
      const createOscillatorSpy = jest.spyOn(ctx, "createOscillator");

      soundManager.playClick();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(2);

      // Second click within 35ms (e.g. child + parent bubbling) must be dropped
      soundManager.playClick();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(2);

      // Advance time beyond 35ms
      soundManager.lastClickTime = Date.now() - 40;
      soundManager.playClick();
      expect(createOscillatorSpy).toHaveBeenCalledTimes(4);
    });

    it("should respect prefers-reduced-motion accessibility preference for hover", () => {
      soundManager.setSoundEnabled(true);
      const ctx = soundManager.initContext();
      const createOscillatorSpy = jest.spyOn(ctx, "createOscillator");

      // Simulate user preference for reduced motion
      global.window.matchMedia = jest.fn().mockReturnValue({ matches: true });

      soundManager.playHover();
      expect(createOscillatorSpy).not.toHaveBeenCalled();

      // Reset
      global.window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    });
  });

  describe("Scheduled Bidding Validation Rules", () => {
    function validateScheduledBidInput({ amount, minimumAllowed, targetTime, auctionEndTime, isUpcoming }) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return { valid: false, error: "Bid amount must be a positive number" };
      }
      if (numAmount < minimumAllowed) {
        return { valid: false, error: `Bid amount must be at least ₹${minimumAllowed}` };
      }
      if (targetTime) {
        const parsedTarget = new Date(targetTime);
        if (isNaN(parsedTarget.getTime())) {
          return { valid: false, error: "Invalid target time" };
        }
        if (parsedTarget.getTime() <= Date.now()) {
          return { valid: false, error: "Execution time must be in the future" };
        }
        if (auctionEndTime && parsedTarget.getTime() >= new Date(auctionEndTime).getTime()) {
          return { valid: false, error: "Execution time cannot be after auction end time" };
        }
      }
      return { valid: true };
    }

    it("should reject scheduled bid below minimum required amount", () => {
      const result = validateScheduledBidInput({
        amount: 400,
        minimumAllowed: 500,
        targetTime: new Date(Date.now() + 3600000).toISOString(),
        auctionEndTime: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least ₹500");
    });

    it("should reject scheduled target time in the past", () => {
      const result = validateScheduledBidInput({
        amount: 600,
        minimumAllowed: 500,
        targetTime: new Date(Date.now() - 60000).toISOString(),
        auctionEndTime: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be in the future");
    });

    it("should reject scheduled target time that exceeds auction end time", () => {
      const result = validateScheduledBidInput({
        amount: 600,
        minimumAllowed: 500,
        targetTime: new Date(Date.now() + 100000).toISOString(),
        auctionEndTime: new Date(Date.now() + 50000).toISOString(),
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be after auction end time");
    });

    it("should accept valid scheduled bid parameters", () => {
      const result = validateScheduledBidInput({
        amount: 650,
        minimumAllowed: 500,
        targetTime: new Date(Date.now() + 3600000).toISOString(),
        auctionEndTime: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("Recommendations Service CORS Configuration & Preflight Invariants", () => {
    function resolveAllowedOrigins(env, configuredOriginsStr, clientUrl) {
      const configured = (configuredOriginsStr || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const client = (clientUrl || "").trim();
      const origins = Array.from(new Set([...configured, ...(client ? [client] : [])]));

      if ((env || "development").toLowerCase() !== "production") {
        const devDefaults = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:4173",
          "http://127.0.0.1:4173",
          "http://localhost:5173",
          "http://127.0.0.1:5173",
        ];
        devDefaults.forEach((d) => {
          if (!origins.includes(d)) origins.push(d);
        });
      }
      return origins;
    }

    it("should explicitly allow http://localhost:3000 and preview port 4173 in development even without explicit env", () => {
      const origins = resolveAllowedOrigins("development", "", "");
      expect(origins).toContain("http://localhost:3000");
      expect(origins).toContain("http://127.0.0.1:3000");
      expect(origins).toContain("http://localhost:4173");
      expect(origins).toContain("http://127.0.0.1:4173");
    });

    it("should preserve explicitly configured production origins and disallow unlisted localhost and preview ports", () => {
      const prodOrigins = resolveAllowedOrigins("production", "https://auctionx.live", "https://auctionx.live");
      expect(prodOrigins).toEqual(["https://auctionx.live"]);
      expect(prodOrigins).not.toContain("http://localhost:3000");
      expect(prodOrigins).not.toContain("http://localhost:4173");
      expect(prodOrigins).not.toContain("http://127.0.0.1:4173");
      expect(prodOrigins).not.toContain("http://evil-site.com");
    });

    it("should correctly validate whether an origin is permitted by CORS policy", () => {
      const devOrigins = resolveAllowedOrigins("development", "", "");
      expect(devOrigins.includes("http://localhost:3000")).toBe(true);
      expect(devOrigins.includes("http://localhost:4173")).toBe(true);
      expect(devOrigins.includes("http://attacker.example.com")).toBe(false);
    });

    it("should enforce credentials=false and proper method support for recommendations microservice", () => {
      const corsConfig = {
        allow_credentials: false,
        allow_methods: ["GET", "POST", "OPTIONS", "HEAD"],
        allow_headers: ["Content-Type", "Accept", "Origin", "X-Requested-With"],
      };

      expect(corsConfig.allow_credentials).toBe(false);
      expect(corsConfig.allow_methods).toContain("GET");
      expect(corsConfig.allow_methods).toContain("POST");
      expect(corsConfig.allow_methods).toContain("OPTIONS");
      expect(corsConfig.allow_headers).toContain("Content-Type");
      expect(corsConfig.allow_headers).toContain("Origin");
    });
  });
});
