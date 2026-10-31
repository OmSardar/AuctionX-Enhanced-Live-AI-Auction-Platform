import React, { useState, useEffect } from "react";
import { soundManager } from "../../utils/soundManager";
import { cn } from "../../lib/utils";
import { FaVolumeUp, FaVolumeMute, FaPlay, FaSlidersH, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import AudioDiagnosticPanel from "./AudioDiagnosticPanel";

/**
 * Enterprise SoundToggle Component
 * Provides a highly discoverable, accessible toggle for UI interaction sounds,
 * plus explicit 'Test Sound' playback control and real-time Web Audio diagnostic panel.
 */
export const SoundToggle = ({
  className,
  showLabel = false,
  variant = "auto",
  showDiagnostics = false,
}) => {
  const [enabled, setEnabled] = useState(soundManager.isSoundEnabled());
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // { success: boolean, msg: string }

  // Diagnostics and adjustment option are disabled for production builds.
  // In non-production, diagnostics are opt-in via showDiagnostics prop or ?audioDiag=true URL parameter.
  const isProduction = Boolean(import.meta.env.PROD || import.meta.env.MODE === "production");
  const hasUrlOverride =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("audioDiag") === "true";
  const showAdjustment = !isProduction && (showDiagnostics || hasUrlOverride);

  useEffect(() => {
    const unsubscribe = soundManager.subscribe((newVal) => {
      setEnabled(newVal);
    });
    return unsubscribe;
  }, []);

  const handleToggle = () => {
    soundManager.toggleSound();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  const handleTestTone = async (e) => {
    e.stopPropagation();
    setIsPlayingTest(true);
    setTestStatus(null);
    try {
      // Must be invoked directly within click event handler for user gesture validity
      const res = await soundManager.playTestTone();
      if (res.success) {
        setTestStatus({
          success: true,
          msg: `✓ Scheduled (${res.durationMs}ms, ${res.contextState})`,
        });
      } else {
        setTestStatus({
          success: false,
          msg: `✕ ${res.error || "Failed"}`,
        });
      }
    } catch (err) {
      setTestStatus({
        success: false,
        msg: `✕ ${err.message || "Failed"}`,
      });
    } finally {
      setTimeout(() => setIsPlayingTest(false), 700);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  const actionTooltip = enabled
    ? "UI Sounds: On (Click to mute)"
    : "UI Sounds: Off (Click to enable)";

  if (showLabel) {
    // Drawer / Settings full switch layout
    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={actionTooltip}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            className={cn(
              "inline-flex items-center gap-3 py-1.5 px-2.5 rounded-lg border transition-all duration-200 select-none cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus",
              enabled
                ? "bg-action-primary/10 border-action-primary/30 text-action-primary"
                : "bg-surface-subtle border-border-subtle text-foreground-secondary hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              {enabled ? (
                <FaVolumeUp className="w-4 h-4 text-action-primary animate-pulse" />
              ) : (
                <FaVolumeMute className="w-4 h-4 text-foreground-muted" />
              )}
              <span className="text-xs font-semibold">
                {enabled ? "Sounds On" : "Sounds Off"}
              </span>
            </span>
            <span
              className={cn(
                "w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 flex items-center",
                enabled ? "bg-action-primary justify-end" : "bg-neutral-400/40 justify-start"
              )}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
            </span>
          </button>

          {/* Test Sound Button & Diag button (disabled for production) */}
          {showAdjustment && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="mobile-test-sound-btn"
                onClick={handleTestTone}
                disabled={isPlayingTest}
                title="Play 650ms synthesized test tone directly"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface border border-border-subtle hover:bg-surface-raised active:scale-95 text-xs font-semibold text-action-primary transition-all cursor-pointer"
              >
                <FaPlay className={`text-[9px] ${isPlayingTest ? "animate-pulse" : ""}`} />
                <span>{isPlayingTest ? "Playing..." : "Test Tone"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDiagOpen(true)}
                title="Open Web Audio Diagnostics"
                className="p-1.5 rounded-md border border-border-subtle bg-surface hover:bg-surface-raised text-foreground-secondary text-xs"
              >
                <FaSlidersH />
              </button>
            </div>
          )}
        </div>

        {testStatus && (
          <div
            className={`text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1.5 ${
              testStatus.success
                ? "bg-status-success-bg/30 border-status-success/40 text-status-success"
                : "bg-status-error-bg/30 border-action-destructive/40 text-action-destructive"
            }`}
          >
            {testStatus.success ? <FaCheckCircle /> : <FaExclamationTriangle />}
            <span>{testStatus.msg}</span>
          </div>
        )}

        {showAdjustment && (
          <AudioDiagnosticPanel isOpen={isDiagOpen} onClose={() => setIsDiagOpen(false)} />
        )}
      </div>
    );
  }

  // Header / Navbar Compact Discoverable Button Group
  return (
    <div className={cn("relative inline-flex items-center", showAdjustment && "gap-1.5", className)}>
      {/* Primary Toggle Switch — Icon-only design */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={actionTooltip}
        title={actionTooltip}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-200 cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus",
          enabled
            ? "bg-action-primary/10 border-action-primary/40 text-action-primary shadow-xs hover:bg-action-primary/20"
            : "bg-surface-subtle/80 border-border-subtle text-foreground-secondary hover:text-foreground hover:bg-surface hover:border-border-default"
        )}
      >
        {enabled ? (
          <FaVolumeUp className="w-4 h-4 text-action-primary" />
        ) : (
          <FaVolumeMute className="w-4 h-4 text-foreground-muted" />
        )}
      </button>

      {/* Audio Diagnostics Modal Opener — disabled for production */}
      {showAdjustment && (
        <button
          type="button"
          onClick={() => setIsDiagOpen(true)}
          title="Open Web Audio Diagnostics & Event Logs"
          aria-label="Open Audio Diagnostics"
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border-subtle bg-surface-subtle/80 text-foreground-muted hover:text-foreground hover:bg-surface text-xs transition-colors cursor-pointer"
        >
          <FaSlidersH className="text-xs" />
        </button>
      )}

      {/* Floating Diagnostic Modal — disabled for production */}
      {showAdjustment && (
        <AudioDiagnosticPanel isOpen={isDiagOpen} onClose={() => setIsDiagOpen(false)} />
      )}
    </div>
  );
};

export default SoundToggle;
