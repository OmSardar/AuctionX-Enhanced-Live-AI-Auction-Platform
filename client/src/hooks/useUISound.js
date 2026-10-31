import { useCallback } from "react";
import soundManager from "../utils/soundManager";

/**
 * useUISound hook
 * Provides convenient methods and event handlers to trigger subtle UI interaction sounds.
 */
export const useUISound = () => {
  const playHover = useCallback(() => {
    soundManager.playHover();
  }, []);

  const playClick = useCallback(() => {
    soundManager.playClick();
  }, []);

  const playSuccess = useCallback(() => {
    soundManager.playSuccess();
  }, []);

  const playError = useCallback(() => {
    soundManager.playError();
  }, []);

  const isSoundEnabled = useCallback(() => {
    return soundManager.isSoundEnabled();
  }, []);

  // Standard props to attach to interactive elements
  const soundProps = {
    onMouseEnter: playHover,
    onFocus: playHover,
    onClick: playClick,
  };

  return {
    playHover,
    playClick,
    playSuccess,
    playError,
    isSoundEnabled,
    soundProps,
    soundManager,
  };
};

export default useUISound;
