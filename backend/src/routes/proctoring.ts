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
    body('type').isIn(['tab_switch', 'fullscreen_exit', 'camera_off', 'window_blur', 'copy_paste_attempt']).withMessage('Invalid violation type'),
    body('examId').notEmpty().withMessage('Exam ID is required'),
    body('sessionId').optional().isString(),
    body('message').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { type, examId, sessionId, message } = req.body
      const studentId = req.user!.id

      // Verify student has an active attempt for this exam
      const attemptCheck = await pool.query(
        'SELECT id FROM exam_attempts WHERE exam_id = $1 AND user_id = $2 AND status = $3',
        [examId, studentId, 'in_progress']
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(403).json({ message: 'No active exam attempt found' })
      }

      const attemptId = attemptCheck.rows[0].id

      // Store violation in database
      await pool.query(
        `INSERT INTO proctoring_violations (attempt_id, student_id, exam_id, type, message, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [sessionId, studentId, examId, type, message]
      )

      // Increment violations metric
      const { incrementExamViolations } = await import('../metrics/examMetrics')
      incrementExamViolations(type, examId, 'placeholder-course-id', studentId)

      // Send real-time notification to teachers
      const io = require('../utils/socketHelper').getIO()
      io.emit('proctoring_violation', {
        attemptId,
        studentId,
        examId,
        type,
        timestamp: new Date(),
        studentName: req.user!.name
      })

      res.json({ 
        success: true, 
        message: 'Violation recorded',
        violationCount: (await pool.query('SELECT violations_count FROM exam_attempts WHERE id = $1', [attemptId])).rows[0].violations_count
      })
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

      // Create session summary record
      const sessionId = `session_${Date.now()}_${studentId.slice(0, 8)}`
      
      await pool.query(
        `INSERT INTO proctoring_session_summary 
         (session_id, attempt_id, student_id, start_time, final_risk_score, risk_level, total_events)
         VALUES ($1, $2, $3, NOW(), 0, 'low', 0)
         ON CONFLICT (session_id) DO UPDATE SET
           start_time = EXCLUDED.start_time,
           updated_at = NOW()`,
        [sessionId, attemptId, studentId]
      )

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
        // AI service expects query parameters, not JSON body
        const aiResponse = await axios.post(`http://ai-proctoring:8000/ai/session/start?attempt_id=${attemptId}&student_id=${studentId}`, null, {
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
        
      } catch (aiError: any) {
        console.error(`[PROCTORING] AI service error:`, aiError.message)
        if (aiError.response) {
          console.error(`[PROCTORING] AI service response status:`, aiError.response.status)
          console.error(`[PROCTORING] AI service response data:`, JSON.stringify(aiError.response.data, null, 2))
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
