import { useEffect, useState, useCallback } from 'react'

interface ExamTimerProps {
  durationMinutes: number
  startedAt: string
  onExpire: () => void
  className?: string
}

export default function ExamTimer({ durationMinutes, startedAt, onExpire, className = '' }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(0)

  // Memoize onExpire to prevent unnecessary re-renders
  const memoizedOnExpire = useCallback(() => {
    onExpire()
  }, [onExpire])

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const end = start + durationMinutes * 60 * 1000

    const tick = () => {
      const now = Date.now()
      const left = Math.max(0, Math.floor((end - now) / 1000))
      setRemaining(left)
      if (left <= 0) memoizedOnExpire()
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [durationMinutes, startedAt, memoizedOnExpire])

  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  const isLow = remaining <= 300

  return (
    <div className={`font-mono text-lg font-semibold ${isLow ? 'text-red-600 animate-pulse' : ''} ${className}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}
