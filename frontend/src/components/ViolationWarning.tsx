import { useState, useEffect } from 'react'
import { AlertTriangle, Eye, EyeOff, Monitor, Camera } from 'lucide-react'

interface Violation {
  id: string
  type: 'tab_switch' | 'fullscreen_exit' | 'copy_paste' | 'right_click'
  message: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high'
}

interface ViolationWarningProps {
  violations: Violation[]
  onDismiss?: (id: string) => void
}

export default function ViolationWarning({ violations, onDismiss }: ViolationWarningProps) {
  const [visibleViolations, setVisibleViolations] = useState<Violation[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Show only new violations that haven't been dismissed
    const newViolations = violations.filter(v => !dismissedIds.has(v.id))
    setVisibleViolations(newViolations.slice(-3)) // Show max 3 recent violations
  }, [violations, dismissedIds])

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id))
    setVisibleViolations(prev => prev.filter(v => v.id !== id))
    onDismiss?.(id)
  }

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'tab_switch':
        return <Monitor className="w-5 h-5" />
      case 'fullscreen_exit':
        return <EyeOff className="w-5 h-5" />
      case 'camera_off':
        return <Camera className="w-5 h-5" />
      case 'no_face':
      case 'multiple_faces':
        return <Eye className="w-5 h-5" />
      default:
        return <AlertTriangle className="w-5 h-5" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 border-red-400 text-red-700'
      case 'medium':
        return 'bg-yellow-100 border-yellow-400 text-yellow-700'
      case 'low':
        return 'bg-blue-100 border-blue-400 text-blue-700'
      default:
        return 'bg-gray-100 border-gray-400 text-gray-700'
    }
  }

  const getViolationMessage = (type: string) => {
    switch (type) {
      case 'tab_switch':
        return 'Tab switching detected. Please stay on the exam page.'
      case 'fullscreen_exit':
        return 'Fullscreen mode exited. Please return to fullscreen.'
      case 'camera_off':
        return 'Camera disconnected. Please check your camera.'
      case 'no_face':
        return 'No face detected. Please ensure your face is visible.'
      case 'multiple_faces':
        return 'Multiple faces detected. Please ensure you are alone.'
      default:
        return 'Suspicious activity detected.'
    }
  }

  if (visibleViolations.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleViolations.map((violation) => (
        <div
          key={violation.id}
          className={`p-4 rounded-lg border-l-4 shadow-lg transform transition-all duration-300 animate-pulse ${getSeverityColor(
            violation.severity
          )}`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getViolationIcon(violation.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {getViolationMessage(violation.type)}
              </p>
              <p className="text-xs opacity-75 mt-1">
                {new Date(violation.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(violation.id)}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
