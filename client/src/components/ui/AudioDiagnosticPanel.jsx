import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import soundManager from "../../utils/soundManager";
import { FaPlay, FaSyncAlt, FaTimes, FaCheckCircle, FaExclamationTriangle, FaVolumeUp } from "react-icons/fa";

/**
 * AudioDiagnosticPanel Component
 * Development and troubleshooting panel providing real-time visibility into the Web Audio API lifecycle.
 */
export const AudioDiagnosticPanel = ({ isOpen, onClose }) => {
  const [diag, setDiag] = useState(soundManager.getDiagnostics());
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    // Initial fetch
    setDiag(soundManager.getDiagnostics());

    const unsubscribe = soundManager.subscribeDiagnostics((updated) => {
      setDiag(updated);
    });

    const interval = setInterval(() => {
      setDiag(soundManager.getDiagnostics());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleTestSound = async () => {
    setIsPlayingTest(true);
    setTestResult(null);
    try {
      // Must be invoked directly within user click handler
      const result = await soundManager.playTestTone();
      setTestResult(result);
      setDiag(soundManager.getDiagnostics());
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message || String(err),
      });
    } finally {
      setTimeout(() => {
        setIsPlayingTest(false);
      }, 700);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-label="Audio System Diagnostics"
      className="fixed bottom-6 left-6 z-[9999] w-[calc(100vw-32px)] sm:w-[460px] max-h-[85vh] bg-surface border-2 border-border-default rounded-2xl shadow-2xl overflow-hidden flex flex-col text-xs text-foreground font-sans animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <FaVolumeUp className="text-action-primary text-sm" />
          <h3 className="font-bold text-sm text-foreground">Web Audio Diagnostics</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-action-primary/10 text-action-primary font-mono font-semibold">
            DEV / TROUBLESHOOTING
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close diagnostic panel"
          className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors"
        >
          <FaTimes className="text-sm" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 overflow-y-auto space-y-4 flex-1">
        {/* Test Tone Action Card */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-subtle space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-foreground text-xs">Acoustic Playback Test</h4>
              <p className="text-[11px] text-foreground-muted">
                Plays a 650ms synthesized 440 Hz test tone directly from your click.
              </p>
            </div>
            <button
              type="button"
              id="btn-play-test-sound"
              onClick={handleTestSound}
              disabled={isPlayingTest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-action-primary text-white font-semibold text-xs shadow-xs hover:bg-action-primary-hover active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <FaPlay className={`text-[10px] ${isPlayingTest ? "animate-pulse" : ""}`} />
              <span>{isPlayingTest ? "Playing Tone..." : "Test Sound"}</span>
            </button>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg text-[11px] font-mono leading-relaxed border ${
                testResult.success
                  ? "bg-status-success-bg/30 border-status-success/30 text-status-success"
                  : "bg-status-error-bg/30 border-action-destructive/30 text-action-destructive"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {testResult.success ? (
                  <>
                    <FaCheckCircle />
                    <span>Audio Tone Successfully Scheduled</span>
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle />
                    <span>Playback Failed with Exception</span>
                  </>
                )}
              </div>
              {testResult.success ? (
                <div className="text-[10px] opacity-90 space-y-0.5">
                  <p>• Frequency: {testResult.frequency} Hz (Standard A4)</p>
                  <p>• Duration: {testResult.durationMs} ms (Fade-in 50ms, Fade-out 150ms)</p>
                  <p>• Output Peak Gain: {testResult.peakGain}</p>
                  <p>• AudioContext State: <span className="font-bold">{testResult.contextState}</span></p>
                  <p>• Output Sample Rate: {testResult.sampleRate} Hz</p>
                  <p>• Destination Max Channels: {testResult.maxChannels}</p>
                  <p className="italic text-foreground-muted mt-1">
                    Note: JavaScript confirmed tone was scheduled into the browser audio graph. If still silent, check if this browser tab is muted or system volume is down.
                  </p>
                </div>
              ) : (
                <div className="text-[10px] text-action-destructive">
                  <p className="font-bold">Error: {testResult.error}</p>
                  {testResult.stack && <pre className="mt-1 text-[9px] overflow-x-auto whitespace-pre-wrap">{testResult.stack}</pre>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* eDEX-UI Tactile Audition Suite */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-subtle space-y-2.5">
          <div>
            <h4 className="font-bold text-foreground text-xs">eDEX-UI Tactile Audio Audition</h4>
            <p className="text-[11px] text-foreground-muted">
              Side-by-side comparison of designed interface micro-sounds (dry, precise, non-musical).
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              id="audition-hover-tic-btn"
              onClick={() => soundManager.playHover()}
              className="p-2 rounded-lg bg-surface border border-border-subtle hover:bg-surface-raised active:scale-95 text-left transition-all cursor-pointer"
            >
              <div className="font-semibold text-action-primary text-xs flex items-center justify-between">
                <span>Hover Tic</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-surface-subtle font-mono">18ms</span>
              </div>
              <div className="text-[10px] text-foreground-muted mt-0.5 font-mono">1400→850Hz sine</div>
            </button>

            <button
              type="button"
              id="audition-click-tac-btn"
              onClick={() => soundManager.playClick()}
              className="p-2 rounded-lg bg-surface border border-border-subtle hover:bg-surface-raised active:scale-95 text-left transition-all cursor-pointer"
            >
              <div className="font-semibold text-action-primary text-xs flex items-center justify-between">
                <span>Click Tac</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-surface-subtle font-mono">34ms</span>
              </div>
              <div className="text-[10px] text-foreground-muted mt-0.5 font-mono">Dual-layer snap</div>
            </button>

            <button
              type="button"
              id="audition-nav-cue-btn"
              onClick={() => soundManager.playNav()}
              className="p-2 rounded-lg bg-surface border border-border-subtle hover:bg-surface-raised active:scale-95 text-left transition-all cursor-pointer"
            >
              <div className="font-semibold text-action-primary text-xs flex items-center justify-between">
                <span>Nav Cue</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-surface-subtle font-mono">22ms</span>
              </div>
              <div className="text-[10px] text-foreground-muted mt-0.5 font-mono">680→450Hz sine</div>
            </button>

            <button
              type="button"
              id="audition-success-btn"
              onClick={() => soundManager.playSuccess()}
              className="p-2 rounded-lg bg-surface border border-border-subtle hover:bg-surface-raised active:scale-95 text-left transition-all cursor-pointer"
            >
              <div className="font-semibold text-status-success text-xs flex items-center justify-between">
                <span>Success</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-surface-subtle font-mono">68ms</span>
              </div>
              <div className="text-[10px] text-foreground-muted mt-0.5 font-mono">C5→G5 dual pip</div>
            </button>

            <button
              type="button"
              id="audition-error-btn"
              onClick={() => soundManager.playError()}
              className="p-2 rounded-lg bg-surface border border-border-subtle hover:bg-surface-raised active:scale-95 text-left transition-all cursor-pointer"
            >
              <div className="font-semibold text-action-destructive text-xs flex items-center justify-between">
                <span>Error Pulse</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-surface-subtle font-mono">62ms</span>
              </div>
              <div className="text-[10px] text-foreground-muted mt-0.5 font-mono">180→130Hz pulse</div>
            </button>
          </div>
        </div>

        {/* Runtime System State Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">
              Audio Engine State
            </h4>
            <button
              onClick={() => setDiag(soundManager.getDiagnostics())}
              className="text-foreground-muted hover:text-foreground flex items-center gap-1 text-[10px]"
            >
              <FaSyncAlt className="text-[9px]" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-foreground-muted block text-[10px]">Web Audio API</span>
              <span className={`font-semibold font-mono ${diag.webAudioSupported ? "text-status-success" : "text-action-destructive"}`}>
                {diag.webAudioSupported ? "Supported" : "Unsupported"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-foreground-muted block text-[10px]">Context State</span>
              <span className={`font-semibold font-mono uppercase ${
                diag.contextState === "running"
                  ? "text-status-success"
                  : diag.contextState === "suspended"
                  ? "text-brand-gold"
                  : "text-foreground-muted"
              }`}>
                {diag.contextState}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-foreground-muted block text-[10px]">UI Sound Toggle</span>
              <span className={`font-semibold font-mono ${diag.isSoundEnabled ? "text-status-success" : "text-foreground-muted"}`}>
                {diag.isSoundEnabled ? "ENABLED (ON)" : "DISABLED (OFF)"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-foreground-muted block text-[10px]">localStorage Key</span>
              <span className="font-semibold font-mono text-foreground">
                {String(diag.storageValue)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-foreground-muted block text-[10px]">Sample Rate</span>
              <span className="font-semibold font-mono text-foreground">
                {diag.sampleRate ? `${diag.sampleRate} Hz` : "N/A"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
              <span className="text-foreground-muted block text-[10px]">Output Channels</span>
              <span className={`font-semibold font-mono ${diag.destinationMaxChannels === 0 ? "text-action-destructive font-bold" : "text-foreground"}`}>
                {diag.destinationMaxChannels !== null ? diag.destinationMaxChannels : "N/A"}
                {diag.destinationMaxChannels === 0 && " (NO OUTPUT DEVICE!)"}
              </span>
            </div>
          </div>
        </div>

        {/* Physical Audio Checklist */}
        <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/40 text-[11px] space-y-1.5">
          <p className="font-bold text-action-primary flex items-center gap-1.5">
            <span>Acoustic Checklist (If sound scheduled but not heard):</span>
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-foreground-secondary text-[10px]">
            <li>Check if the Chrome/Edge browser tab is muted (Right-click tab → "Unmute site").</li>
            <li>Verify computer speaker / headphone volume is turned up in Windows.</li>
            <li>Verify default audio output device in Windows Settings (WASAPI / Realtek / Bluetooth).</li>
            <li>Make sure browser autoplay is not permanently blocked for localhost.</li>
          </ul>
        </div>

        {/* Event Logs */}
        <div className="space-y-1.5">
          <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">
            Audio Lifecycle Event Log (Last 10)
          </h4>
          <div className="bg-canvas border border-border-subtle rounded-lg p-2 max-h-36 overflow-y-auto font-mono text-[10px] space-y-1 scrollbar-thin">
            {diag.eventLogs && diag.eventLogs.length > 0 ? (
              diag.eventLogs.slice(-10).reverse().map((ev) => (
                <div key={ev.id} className="border-b border-border-subtle/50 pb-0.5 last:border-none flex items-start gap-1.5">
                  <span className="text-foreground-muted shrink-0">[{ev.timestamp}]</span>
                  <span className={`font-semibold ${
                    ev.type.includes("ERROR") || ev.type.includes("FAILED")
                      ? "text-action-destructive"
                      : ev.type.includes("SCHEDULED") || ev.type.includes("PLAYED")
                      ? "text-status-success"
                      : "text-action-primary"
                  }`}>
                    {ev.type}
                  </span>
                  <span className="text-foreground-secondary truncate">
                    {ev.contextState && `[${ev.contextState}] `}
                    {ev.error || ev.message || (ev.durationMs && `${ev.durationMs}ms`) || ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-foreground-muted italic">No audio events recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default AudioDiagnosticPanel;
