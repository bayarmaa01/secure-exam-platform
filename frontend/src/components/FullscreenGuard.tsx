import { useEffect } from "react";

export default function FullscreenGuard({ onExit }: { onExit: () => void }) {
  useEffect(() => {
    const enterFullscreen = async () => {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    };

    enterFullscreen();

    const handleChange = () => {
      if (!document.fullscreenElement) {
        onExit();
      }
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  return null;
}
