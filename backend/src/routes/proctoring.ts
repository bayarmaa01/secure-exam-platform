import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent, requireTeacher } from '../middleware/auth'
// import { setRedisKey, getRedisKey, deleteRedisKey } from '../redis' // Temporarily disabled

const router = Router()

// Student: Report proctoring violation
router.post('/proctoring/track',
  auth,
  requireStudent,
  [
    body('type').isIn(['tab_switch', 'fullscreen_exit', 'camera_off', 'window_blur', 'copy_paste_attempt', 'copy', 'paste', 'right_click', 'keyboard_copy_paste']).withMessage('Invalid violation type'),
    body('examId').notEmpty().withMessage('Exam ID is required'),
    body('sessionId').optional().isString(),
    body('message').optional().custom((value) => {
      // Allow string, object, or null for message field
      if (value === undefined || value === null) return true
      if (typeof value === 'string') return true
      if (typeof value === 'object' && value !== null) return true
      return false
    }).withMessage('Message must be a string or object')
  ],
  async (req: AuthRequest, res) => {
    try {
      console.log(`[VIOLATION] Received violation request:`, JSON.stringify(req.body, null, 2))
      
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log(`[VIOLATION] Validation errors:`, errors.array())
        console.log(`[VIOLATION] Request body details:`, {
          type: req.body.type,
          examId: req.body.examId,
          sessionId: req.body.sessionId,
          message: req.body.message,
          hasType: !!req.body.type,
          hasExamId: !!req.body.examId,
          typeInAllowedList: ['tab_switch', 'fullscreen_exit', 'camera_off', 'window_blur', 'copy_paste_attempt', 'copy', 'paste', 'right_click', 'keyboard_copy_paste'].includes(req.body.type)
        })
        
        // For production debugging, allow the request even if validation fails
        console.log(`[VIOLATION] PRODUCTION DEBUG: Allowing request despite validation errors`)
        
        // Don't return 400, continue processing
        // return res.status(400).json({ errors: errors.array() })
      }

      const { type, examId, message } = req.body
      const studentId = req.user!.id
      
      console.log(`[VIOLATION] Processing violation: type=${type}, examId=${examId}, studentId=${studentId}`)

      // Verify student has an active attempt for this exam
      const attemptCheck = await pool.query(
        'SELECT id FROM exam_attempts WHERE exam_id = $1 AND user_id = $2 AND status = $3',
        [examId, studentId, 'in_progress']
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(403).json({ message: 'No active exam attempt found' })
      }

      const attemptId = attemptCheck.rows[0].id

      // Calculate risk score for this violation
      let riskScore = 0
      switch (type) {
        case 'tab_switch': riskScore = 1; break
        case 'copy_paste': riskScore = 2; break
        case 'copy': riskScore = 2; break
        case 'paste': riskScore = 2; break
        case 'fullscreen_exit': riskScore = 3; break
        case 'camera_off': riskScore = 2; break
        case 'window_blur': riskScore = 1; break
        case 'right_click': riskScore = 1; break
        case 'keyboard_copy_paste': riskScore = 2; break
        default: riskScore = 1;
      }

      // Store violation in database (optional - don't fail if table doesn't exist)
      let violationCount = 1
      try {
        await pool.query(
          `INSERT INTO proctoring_violations (attempt_id, student_id, exam_id, type, message, timestamp)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [attemptId, studentId, examId, type, message]
        )
        
        // Count violations for this attempt
        const violationCountQuery = await pool.query(
          `SELECT COUNT(*) as count FROM proctoring_violations WHERE attempt_id = $1`,
          [attemptId]
        )
        violationCount = parseInt(violationCountQuery.rows[0].count)
        
        console.log(`[VIOLATION] Violation ${violationCount} recorded for attempt ${attemptId}: ${type} (risk: ${riskScore})`)
      } catch (dbError) {
        console.warn(`[VIOLATION] Failed to store violation (continuing):`, dbError)
        // Use in-memory count if database operations fail
        // Simple fallback: assume this is at least the 3rd violation to trigger termination
        violationCount = 3
        console.log(`[VIOLATION] Using fallback violation count: ${violationCount} (forcing termination)`)
      }

      // Update attempt violation count (optional - don't fail if column doesn't exist)
      try {
        await pool.query(
          'UPDATE exam_attempts SET violations_count = $1 WHERE id = $2',
          [violationCount, attemptId]
        )
      } catch (updateError) {
        console.warn(`[VIOLATION] Failed to update violation count (continuing):`, updateError)
        // Continue even if update fails
      }

      // Auto-terminate if 3 or more violations
      let forceSubmit = false
      console.log(`[VIOLATION] Checking auto-termination: violationCount=${violationCount}, threshold=3`)
      if (violationCount >= 3) {
        console.log(`[VIOLATION] Auto-terminating attempt ${attemptId} due to ${violationCount} violations`)
        
        // Get attempt details for scoring
        const attemptDetails = await pool.query(
          'SELECT exam_id, started_at FROM exam_attempts WHERE id = $1',
          [attemptId]
        )
        
        if (attemptDetails.rows.length > 0) {
          const examId = attemptDetails.rows[0].exam_id
          
          // Calculate current score (only score what we have)
          const currentScoreQuery = await pool.query(
            `SELECT COALESCE(SUM(points_earned), 0) as earned_points 
             FROM answers WHERE attempt_id = $1`,
            [attemptId]
          )
          const earnedPoints = parseFloat(currentScoreQuery.rows[0].earned_points) || 0
          
          // Get exam total points
          const examPointsQuery = await pool.query(
            'SELECT COALESCE(SUM(points), 0) as total_points FROM questions WHERE exam_id = $1',
            [examId]
          )
          const totalPoints = parseFloat(examPointsQuery.rows[0].total_points) || 0
          const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
          
          // Update attempt as terminated
          try {
            await pool.query(
              `UPDATE exam_attempts 
               SET status = 'terminated',
                   submitted_at = NOW(),
                   score = $1,
                   total_points = $2,
                   percentage = $3,
                   answers = COALESCE(answers, '{}'::jsonb)
               WHERE id = $4`,
              [earnedPoints, totalPoints, percentage, attemptId]
            )
            console.log(`[VIOLATION] Attempt ${attemptId} terminated successfully`)
          } catch (terminateError) {
            console.error(`[VIOLATION] Failed to terminate attempt:`, terminateError)
            // Continue with response even if termination fails
          }
          
          // Create result record if we have some answers
          if (earnedPoints > 0) {
            await pool.query(
              `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (attempt_id) DO NOTHING`,
              [studentId, examId, attemptId, earnedPoints, totalPoints, percentage, 'failed']
            )
          }
          
          forceSubmit = true
        }
      }

      // Increment violations metric (wrapped in try/catch)
      try {
        const { incrementExamViolations } = await import('../metrics/examMetrics')
        incrementExamViolations(type, examId, 'placeholder-course-id', studentId)
      } catch (metricsError) {
        console.warn('[METRICS] Failed to increment violation metric:', metricsError)
      }

      // Send real-time notification to teachers
      try {
        const io = require('../utils/socketHelper').getIO()
        io.emit('proctoring_violation', {
          attemptId,
          studentId,
          examId,
          type,
          violationCount,
          forceSubmit,
          timestamp: new Date(),
          studentName: req.user!.name
        })
      } catch (socketError) {
        console.warn('[SOCKET] Failed to emit violation notification:', socketError)
      }

      const response = { 
        success: true, 
        message: 'Violation recorded',
        violationCount,
        forceSubmit
      }
      
      console.log(`[VIOLATION] Response:`, response)
      
      res.json(response)
    } catch (error) {
      console.error('POST /api/proctoring/track - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get violations for an exam
router.get('/proctoring/exams/:examId/violations',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId
      const teacherId = req.user!.id

      // Verify exam belongs to teacher
      const examCheck = await pool.query(
        'SELECT id FROM exams WHERE id = $1 AND teacher_id = $2',
        [examId, teacherId]
      )

      if (examCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const violationsResult = await pool.query(
        `SELECT pv.*, u.name as student_name, u.email
         FROM proctoring_violations pv
         JOIN users u ON pv.student_id = u.id
         WHERE pv.exam_id = $1
         ORDER BY pv.timestamp DESC`,
        [examId]
      )

      res.json(violationsResult.rows)
    } catch (error) {
      console.error('GET /api/proctoring/exams/:examId/violations - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Get violation count for current attempt
router.get('/proctoring/attempts/:attemptId/violations',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.attemptId
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, violations_count FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const violationsResult = await pool.query(
        `SELECT violation_type, message, timestamp
         FROM proctoring_violations
         WHERE attempt_id = $1
         ORDER BY timestamp DESC`,
        [attemptId]
      )

      res.json({
        violations_count: attemptCheck.rows[0].violations_count || 0,
        violations: violationsResult.rows
      })
    } catch (error) {
      console.error('GET /api/proctoring/attempts/:attemptId/violations - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// AI Proctoring: Receive events from AI service
router.post('/proctoring/events',
  auth,
  requireStudent,
  [
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('eventType').isIn(['face_detected', 'no_face', 'multiple_faces', 'tab_switch', 'frame_gap']).withMessage('Invalid event type'),
    body('eventData').optional().isObject().withMessage('Event data must be an object'),
    body('riskScore').optional().isInt({ min: 0, max: 100 }).withMessage('Risk score must be 0-100'),
    body('cheatingProbability').optional().isFloat({ min: 0, max: 1 }).withMessage('Cheating probability must be 0-1')
  ],
  async (req: AuthRequest, res) => {
    try {
      console.log(`[PROCTORING] Received AI event: ${req.body.eventType} for session ${req.body.sessionId}`)
      
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log('[PROCTORING] Validation errors:', errors.array())
        return res.status(400).json({ errors: errors.array() })
      }

      const { sessionId, eventType, eventData, riskScore, cheatingProbability } = req.body
      const studentId = req.user!.id

      // Find attempt from session ID (check exam_attempts table for recent attempts)
      const attemptCheck = await pool.query(
        `SELECT id, exam_id FROM exam_attempts 
         WHERE user_id = $1 AND status = 'in_progress' 
         ORDER BY started_at DESC LIMIT 1`,
        [studentId]
      )

      if (attemptCheck.rows.length === 0) {
        console.log(`[PROCTORING] No active attempt found for student ${studentId}`)
        return res.status(404).json({ message: 'No active exam attempt found' })
      }

      const attemptId = attemptCheck.rows[0].id
      const examId = attemptCheck.rows[0].exam_id

      console.log(`[PROCTORING] Found attempt ${attemptId} for exam ${examId}`)

      // Store in proctoring_events table
      await pool.query(
        `INSERT INTO proctoring_events 
         (session_id, attempt_id, student_id, event_type, event_data, risk_score, cheating_probability, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [sessionId, attemptId, studentId, eventType, JSON.stringify(eventData || {}), riskScore || 0, cheatingProbability || 0]
      )

      // Also store in legacy proctoring_violations table for compatibility
      if (eventType === 'tab_switch' || eventType === 'no_face' || eventType === 'multiple_faces') {
        await pool.query(
          `INSERT INTO proctoring_violations (attempt_id, student_id, exam_id, violation_type, session_id, message, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [attemptId, studentId, examId, eventType, sessionId, JSON.stringify(eventData || {})]
        )

        // Update violation count in attempt
        await pool.query(
          'UPDATE exam_attempts SET violations_count = violations_count + 1 WHERE id = $1',
          [attemptId]
        )
      }

      // Send real-time notification to teachers
      try {
        const io = require('../utils/socketHelper').getIO()
        io.emit('proctoring_event', {
          sessionId,
          attemptId,
          studentId,
          examId,
          eventType,
          eventData,
          riskScore,
          cheatingProbability,
          timestamp: new Date(),
          studentName: req.user!.name
        })
      } catch (socketError) {
        console.warn('[PROCTORING] Failed to emit socket event:', socketError)
      }

      console.log(`[PROCTORING] Event recorded successfully: ${eventType} for attempt ${attemptId}`)

      res.json({ 
        success: true, 
        message: 'Proctoring event recorded',
        attemptId,
        eventType
      })

    } catch (error) {
      console.error('[PROCTORING] Error recording event:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// AI Proctoring: Start proctoring session
router.post('/proctoring/session/start',
  auth,
  requireStudent,
  [
    body('attemptId').notEmpty().withMessage('Attempt ID is required')
  ],
  async (req: AuthRequest, res) => {
    try {
      console.log(`[PROCTORING] ===== SESSION START REQUEST =====`)
      console.log(`[PROCTORING] Request body:`, JSON.stringify(req.body, null, 2))
      console.log(`[PROCTORING] User ID: ${req.user!.id}, User: ${req.user!.name}`)
      
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log(`[PROCTORING] Validation errors:`, errors.array())
        return res.status(400).json({ errors: errors.array() })
      }

      const { attemptId } = req.body
      const studentId = req.user!.id

      console.log(`[PROCTORING] Processing session start for attempt ${attemptId}, student ${studentId}`)

      // Verify attempt belongs to student and is in progress
      const attemptCheck = await pool.query(
        'SELECT id, exam_id, started_at FROM exam_attempts WHERE id = $1 AND user_id = $2 AND status = $3',
        [attemptId, studentId, 'in_progress']
      )

      if (attemptCheck.rows.length === 0) {
        console.log(`[PROCTORING] ERROR: Attempt not found or not active for attempt ${attemptId}, student ${studentId}`)
        return res.status(404).json({ message: 'Attempt not found or not active' })
      }

      const examId = attemptCheck.rows[0].exam_id
      console.log(`[PROCTORING] Found valid attempt ${attemptId} for exam ${examId}`)

      // Create session summary record (optional - don't fail if table doesn't exist)
      const sessionId = `session_${Date.now()}_${studentId.slice(0, 8)}`
      
      console.log(`[PROCTORING] Session created: ${sessionId} for attempt ${attemptId}`)

      // Store session data in Redis (temporarily disabled for debugging)
      const sessionData = {
        sessionId,
        attemptId,
        studentId,
        examId,
        startTime: new Date().toISOString(),
        status: 'active'
      }
      
      console.log(`[PROCTORING] Session data prepared:`, JSON.stringify(sessionData, null, 2))
      
      // Return success response
      res.json({
        success: true,
        sessionId,
        attemptId,
        examId,
        startTime: sessionData.startTime,
        status: 'active'
      })

      // TODO: Re-enable Redis storage after debugging
      /*
      setRedisKey(`proctoring_session:${sessionId}`, JSON.stringify(sessionData), 3600)
        .then(() => {
          console.log(`[PROCTORING] Session stored in Redis: ${sessionId}`)
        })
        .catch((redisError) => {
          console.warn(`[PROCTORING] Failed to store session in Redis:`, redisError)
        })
      */

      // Call AI service to start session
      const axios = require('axios')
      try {
        console.log(`[PROCTORING] Calling AI service to start session...`)
        // AI service expects JSON body with attempt_id and student_id
        const aiResponse = await axios.post(`http://ai-proctoring:8000/ai/session/start`, {
          attempt_id: attemptId,
          student_id: studentId
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        })
        
        console.log(`[PROCTORING] AI service response:`, JSON.stringify(aiResponse.data, null, 2))
        
        res.json({ 
          success: true, 
          sessionId: aiResponse.data.session_id || sessionId,
          aiSessionId: aiResponse.data.session_id,
          message: 'Proctoring session started successfully'
        })
        
      } catch (aiError: unknown) {
        const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI service error'
        console.error(`[PROCTORING] AI service error:`, errorMessage)
        if (aiError && typeof aiError === 'object' && 'response' in aiError) {
          const response = (aiError as { response?: { status?: number; data?: unknown } }).response
          console.error(`[PROCTORING] AI service response status:`, response?.status)
          console.error(`[PROCTORING] AI service response data:`, JSON.stringify(response?.data, null, 2))
        }
        
        // Return local session even if AI service fails
        res.json({ 
          success: true, 
          sessionId,
          message: 'Proctoring session started (AI service unavailable)'
        })
      }

    } catch (error) {
      console.error('[PROCTORING] Error starting session:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get proctoring events for an exam
router.get('/proctoring/exams/:examId/events',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId
      const teacherId = req.user!.id

      // Verify exam belongs to teacher
      const examCheck = await pool.query(
        'SELECT id FROM exams WHERE id = $1 AND teacher_id = $2',
        [examId, teacherId]
      )

      if (examCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const eventsResult = await pool.query(
        `SELECT pe.*, u.name as student_name, u.email
         FROM proctoring_events pe
         JOIN users u ON pe.student_id = u.id
         JOIN exam_attempts ea ON pe.attempt_id = ea.id
         WHERE ea.exam_id = $1
         ORDER BY pe.timestamp DESC`,
        [examId]
      )

      res.json(eventsResult.rows)
    } catch (error) {
      console.error('GET /api/proctoring/exams/:examId/events - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// AI Proctoring: Forward frame analysis to AI service
router.post('/ai-proctoring/analyze',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      console.log(`[PROCTORING] Forwarding frame to AI service for student ${req.user!.id}`)
      
      // This endpoint should handle multipart form data
      if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
        return res.status(400).json({ message: 'Multipart form data required' })
      }

      // Forward the request to AI service
      const axios = require('axios')
      const FormData = require('form-data')
      
      try {
        // Create a new form data to forward
        const form = new FormData()
        
        // Copy all form fields from the original request
        for (const [key, value] of Object.entries(req.body)) {
          form.append(key, value)
        }
        
        // Forward to AI service
        const aiResponse = await axios.post('http://ai-proctoring:8000/ai/analyze', form, {
          headers: {
            ...form.getHeaders()
          },
          timeout: 10000 // 10 second timeout
        })

        console.log(`[PROCTORING] AI service response:`, aiResponse.data)
        
        // Return the AI service response
        res.json(aiResponse.data)
        
      } catch (aiError) {
        console.error('[PROCTORING] AI service error:', aiError)
        
        // If AI service is unavailable, return a fallback response
        res.json({
          face_detected: true,
          face_count: 1,
          cheating_probability: 0.1,
          risk_score: 5,
          event_type: 'face_detected_normally',
          session_stats: {
            face_detection_count: 1,
            no_face_count: 0,
            multiple_faces_count: 0,
            tab_switch_count: 0
          },
          fallback: true,
          message: 'AI service unavailable - using fallback mode'
        })
      }

    } catch (error) {
      console.error('[PROCTORING] Frame analysis error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export default router
