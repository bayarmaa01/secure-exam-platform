import { useEffect, useRef } from "react";
import { apiRequest } from "../services/api";

type WebcamStatusProps = {
  userId: string; // current student ID
  onCheatingDetected: () => void; // callback for auto-submit
};

export default function WebcamStatus({
  userId,
  onCheatingDetected,
}: WebcamStatusProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Request webcam
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => alert("Webcam access is required"));

    // Detect tab switching
    const onBlur = () => alert("Tab switch detected! Cheating flag raised.");
    document.addEventListener("visibilitychange", onBlur);

    // Send frame to AI every 5 seconds
    intervalRef.current = window.setInterval(async () => {
      if (!videoRef.current) return;
      const video = videoRef.current;

      // Draw frame to canvas
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert frame to base64
      const frame = canvas.toDataURL("image/jpeg");

      try {
        const res = await fetch("http://localhost:7000/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frame, user_id: userId }),
        });
        const data = await res.json();

        if (data.flags?.length > 0 && data.cheating_score > 0.7) {
          alert("Cheating detected! Auto-submitting exam.");
          onCheatingDetected();
        }
      } catch (err) {
        console.error("AI service error", err);
      }
    }, 5000);

    return () => {
      document.removeEventListener("visibilitychange", onBlur);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, onCheatingDetected]);

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: "none" }}
      />
      <p>Webcam monitoring active</p>
    </div>
  );
}
