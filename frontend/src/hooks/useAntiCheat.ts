import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import api from '../api'

// Type definition for window object with process env
interface WindowWithProcessEnv extends Window {
  process?: {
    env?: {
      REACT_APP_API_URL?: string
    }
  }
}

interface Violation {
  type: 'tab_switch' | 'fullscreen_exit' | 'copy_paste' | 'right_click'
  details: string
  timestamp: string
}

interface AntiCheatConfig {
  preventTabSwitch: boolean
  preventFullscreenExit: boolean
  preventCopyPaste: boolean
  preventRightClick: boolean
}

export const useAntiCheat = (
  sessionId: string,
  config: AntiCheatConfig = {
    preventTabSwitch: true,
    preventFullscreenExit: true,
    preventCopyPaste: true,
    preventRightClick: true
  }
) => {
  const [violations, setViolations] = useState<Violation[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTabActive, setIsTabActive] = useState(true)
  const socketRef = useRef<Socket | null>(null)
  const lastViolationTimeRef = useRef<number>(0)

  // Record violation with throttling
  const recordViolation = useCallback((type: Violation['type'], details: string) => {
    const now = Date.now()
    
    // Throttle violations to avoid spam (max 1 per second)
    if (now - lastViolationTimeRef.current < 1000) {
      return
    }
    
    lastViolationTimeRef.current = now
    
    const violation: Violation = {
      type,
      details,
      timestamp: new Date().toISOString()
    }
    
    // Add to local state
    setViolations(prev => [...prev, violation])
    
    // Send to backend
    if (socketRef.current && sessionId) {
      socketRef.current.emit('record_violation', {
        sessionId,
        type,
        details,
        timestamp: violation.timestamp
      })
    }
    
    // Also send via HTTP API as backup
    api.post(`/sessions/${sessionId}/violations`, {
      type,
      details,
      timestamp: violation.timestamp
    }).catch(error => {
      console.error('Failed to record violation:', error)
    })
  }, [sessionId])

  // Initialize socket connection
  useEffect(() => {
    const apiUrl = (window as WindowWithProcessEnv).process?.env?.REACT_APP_API_URL || 'http://localhost:4000'
    socketRef.current = io(apiUrl)
    
    socketRef.current.on('connect', () => {
      console.log('Anti-cheat socket connected')
    })

    socketRef.current.on('disconnect', () => {
      console.log('Anti-cheat socket disconnected')
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  // Track tab visibility changes
  useEffect(() => {
    if (!config.preventTabSwitch) return

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      
      if (!isVisible && isTabActive) {
        recordViolation('tab_switch', 'Tab switched or minimized')
      }
      
      setIsTabActive(isVisible)
    }

    const handleFocus = () => {
      setIsTabActive(true)
    }

    const handleBlur = () => {
      if (document.visibilityState === 'visible') {
        recordViolation('tab_switch', 'Tab lost focus')
      }
      setIsTabActive(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [config.preventTabSwitch, isTabActive, recordViolation])

  // Track fullscreen changes
  useEffect(() => {
    if (!config.preventFullscreenExit) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
      )

      if (isFullscreen && !isCurrentlyFullscreen) {
        recordViolation('fullscreen_exit', 'Fullscreen mode exited')
      }
      
      setIsFullscreen(isCurrentlyFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [config.preventFullscreenExit, isFullscreen, recordViolation])

  // Prevent copy/paste
  useEffect(() => {
    if (!config.preventCopyPaste) return

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      recordViolation('copy_paste', 'Copy attempt detected')
    }

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      recordViolation('copy_paste', 'Paste attempt detected')
    }

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault()
      recordViolation('copy_paste', 'Cut attempt detected')
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      recordViolation('right_click', 'Right click attempt detected')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent common keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
          case 'v':
          case 'x':
            e.preventDefault()
            recordViolation('copy_paste', `Keyboard shortcut detected: ${e.key}`)
            break
          case 'f':
            if (e.shiftKey) {
              e.preventDefault()
              recordViolation('fullscreen_exit', 'Fullscreen shortcut detected')
            }
            break
        }
      }
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('cut', handleCut)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [config.preventCopyPaste, recordViolation])

  // Request fullscreen
  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
    } else if ((elem as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
      ((elem as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen)?.()
    } else if ((elem as unknown as { mozRequestFullScreen?: () => void }).mozRequestFullScreen) {
      ((elem as unknown as { mozRequestFullScreen?: () => void }).mozRequestFullScreen)?.()
    } else if ((elem as unknown as { msRequestFullscreen?: () => void }).msRequestFullscreen) {
      ((elem as unknown as { msRequestFullscreen?: () => void }).msRequestFullscreen)?.()
    }
  }, [])

  // Check auto-submit conditions
  const shouldAutoSubmit = useCallback(() => {
    const VIOLATION_THRESHOLD = 5 // Auto-submit after 5 violations
    return violations.length >= VIOLATION_THRESHOLD
  }, [violations])

  return {
    violations,
    isFullscreen,
    isTabActive,
    recordViolation,
    requestFullscreen,
    shouldAutoSubmit,
    violationCount: violations.length
  }
}
