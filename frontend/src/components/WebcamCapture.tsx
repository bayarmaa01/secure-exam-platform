import { useEffect, useRef, useState } from 'react'

interface WebcamCaptureProps {
  onFrame?: (blob: Blob) => void
  intervalMs?: number
  className?: string
}

export default function WebcamCapture({ onFrame, intervalMs = 5000, className = '' }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setReady(true)
        }
      })
      .catch((e) => setError(e.message || 'Camera access denied'))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !onFrame || !videoRef.current) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const capture = () => {
      const video = videoRef.current
      if (!video || !ctx || video.readyState < 2) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      canvas.toBlob((blob) => blob && onFrame(blob), 'image/jpeg', 0.7)
    }

    const id = setInterval(capture, intervalMs)
    return () => clearInterval(id)
  }, [ready, onFrame, intervalMs])

  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-900 ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 text-white p-2 text-sm">
          {error}
        </div>
      )}
      {ready && !error && (
        <div className="absolute bottom-1 right-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded">
          Live
        </div>
      )}
    </div>
  )
}
