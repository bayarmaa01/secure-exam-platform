import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher, requireStudent, requireAdmin } from '../middleware/auth'

const router = Router()

// Record security violation
router.post('/security/violation',
  auth,
  requireStudent,
  [
    body('attempt_id').isUUID(),
    body('violation_type').isIn(['tab_switch', 'fullscreen_exit', 'camera_violation', 'copy_paste', 'face_not_detected', 'multiple_faces']),
    body('severity').isIn(['low', 'medium', 'high', 'critical']),
    body('details').optional().isObject()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { attempt_id, violation_type, severity, details = {} } = req.body
      const studentId = req.user!.id

      // Verify attempt ownership
      const attemptCheck = await pool.query(
        'SELECT id, exam_id FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attempt_id, studentId]
      )
      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      // Record violation
      await pool.query(
        `INSERT INTO security_violations (attempt_id, violation_type, severity, details)
         VALUES ($1, $2, $3, $4)`,
        [attempt_id, violation_type, severity, JSON.stringify(details)]
      )

      // Update attempt violation counts
      const updateField = getViolationCountField(violation_type)
      await pool.query(
        `UPDATE exam_attempts 
         SET ${updateField} = ${updateField} + 1,
             total_violations = total_violations + 1
         WHERE id = $1`,
        [attempt_id]
      )

      // Calculate cheating score based on violations
      await updateCheatingScore(attempt_id)

      res.json({ message: 'Violation recorded successfully' })
    } catch (error) {
      console.error('Security violation recording error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get security violations for an attempt
router.get('/security/violations/:attempt_id',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.id

      // Verify access permissions
      const attemptCheck = await pool.query(
        'SELECT ea.id, ea.user_id, e.teacher_id FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id WHERE ea.id = $1',
        [attemptId]
      )
      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const attempt = attemptCheck.rows[0]
      if (req.user!.role === 'student' && attempt.user_id !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' })
      }
      if (req.user!.role === 'teacher' && attempt.teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const r = await pool.query(
        `SELECT violation_type, severity, timestamp, details
         FROM security_violations
         WHERE attempt_id = $1
         ORDER BY timestamp DESC`,
        [attemptId]
      )

      res.json(r.rows)
    } catch (error) {
      console.error('Get violations error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get exam security settings
router.get('/security/settings/:exam_id',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.id

      const r = await pool.query(
        `SELECT 
           fullscreen_required,
           tab_switch_detection,
           copy_paste_blocked,
           camera_required,
           face_detection_enabled
         FROM exams
         WHERE id = $1`,
        [examId]
      )

      if (r.rows.length === 0) {
        return res.status(404).json({ message: 'Exam not found' })
      }

      res.json(r.rows[0])
    } catch (error) {
      console.error('Get security settings error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get security analytics for teachers
router.get('/security/analytics',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id

      // Get security violations summary
      const violationsSummary = await pool.query(`
        SELECT 
          sv.violation_type,
          COUNT(sv.id) as count,
          COUNT(DISTINCT ea.user_id) as affected_students,
          AVG(ea.cheating_score) as avg_cheating_score
        FROM security_violations sv
        JOIN exam_attempts ea ON sv.attempt_id = ea.id
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.teacher_id = $1
        GROUP BY sv.violation_type
        ORDER BY count DESC
      `, [teacherId])

      // Get high-risk students
      const highRiskStudents = await pool.query(`
        SELECT 
          u.name,
          u.student_id,
          COUNT(sv.id) as violation_count,
          AVG(ea.cheating_score) as avg_cheating_score,
          MAX(ea.cheating_score) as max_cheating_score
        FROM security_violations sv
        JOIN exam_attempts ea ON sv.attempt_id = ea.id
        JOIN users u ON ea.user_id = u.id
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.teacher_id = $1
        GROUP BY u.id, u.name, u.student_id
        HAVING COUNT(sv.id) > 0
        ORDER BY violation_count DESC, avg_cheating_score DESC
        LIMIT 20
      `, [teacherId])

      // Get exam security performance
      const examSecurityPerformance = await pool.query(`
        SELECT 
          e.title,
          e.id,
          COUNT(DISTINCT ea.user_id) as total_students,
          COUNT(DISTINCT CASE WHEN sv.id IS NOT NULL THEN ea.user_id END) as students_with_violations,
          COUNT(sv.id) as total_violations,
          AVG(ea.cheating_score) as avg_cheating_score
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        LEFT JOIN security_violations sv ON ea.id = sv.attempt_id
        WHERE e.teacher_id = $1
        GROUP BY e.id, e.title
        ORDER BY e.created_at DESC
      `, [teacherId])

      res.json({
        violationsSummary: violationsSummary.rows,
        highRiskStudents: highRiskStudents.rows,
        examSecurityPerformance: examSecurityPerformance.rows
      })
    } catch (error) {
      console.error('Security analytics error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// AI cheating detection endpoint
router.post('/security/ai-detection',
  auth,
  requireStudent,
  [
    body('attempt_id').isUUID(),
    body('behavior_data').isObject(),
    body('camera_data').optional().isObject()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { attempt_id, behavior_data, camera_data } = req.body
      const studentId = req.user!.id

      // Verify attempt ownership
      const attemptCheck = await pool.query(
        'SELECT id FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attempt_id, studentId]
      )
      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      // AI-based cheating detection logic
      const cheatingScore = calculateAICheatingScore(behavior_data, camera_data)
      
      // Update cheating score
      await pool.query(
        'UPDATE exam_attempts SET cheating_score = $1 WHERE id = $2',
        [cheatingScore, attempt_id]
      )

      // Flag suspicious behavior if score is high
      if (cheatingScore > 70) {
        await pool.query(
          `INSERT INTO security_violations (attempt_id, violation_type, severity, details)
           VALUES ($1, 'ai_detected', 'high', $2)`,
          [attempt_id, JSON.stringify({ ai_score: cheatingScore, behavior_data, camera_data })]
        )
      }

      res.json({ 
        cheatingScore,
        riskLevel: getRiskLevel(cheatingScore),
        recommendations: getRecommendations(cheatingScore)
      })
    } catch (error) {
      console.error('AI detection error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Helper functions
function getViolationCountField(violationType: string): string {
  const fieldMap: { [key: string]: string } = {
    'tab_switch': 'tab_switch_count',
    'fullscreen_exit': 'fullscreen_violations',
    'camera_violation': 'camera_violations',
    'copy_paste': 'copy_paste_violations',
    'face_not_detected': 'camera_violations',
    'multiple_faces': 'camera_violations'
  }
  return fieldMap[violationType] || 'total_violations'
}

async function updateCheatingScore(attemptId: string): Promise<void> {
  try {
    // Calculate cheating score based on violations
    const r = await pool.query(
      `SELECT 
         COUNT(CASE WHEN severity = 'critical' THEN 1 END) * 40 +
         COUNT(CASE WHEN severity = 'high' THEN 1 END) * 25 +
         COUNT(CASE WHEN severity = 'medium' THEN 1 END) * 15 +
         COUNT(CASE WHEN severity = 'low' THEN 1 END) * 5 as cheating_score
       FROM security_violations
       WHERE attempt_id = $1`,
      [attemptId]
    )

    const score = Math.min(r.rows[0].cheating_score, 100)
    
    await pool.query(
      'UPDATE exam_attempts SET cheating_score = $1 WHERE id = $2',
      [score, attemptId]
    )
  } catch (error) {
    console.error('Error updating cheating score:', error)
  }
}

function calculateAICheatingScore(behavior_data: any, camera_data: any): number {
  let score = 0
  
  // Analyze behavior patterns
  if (behavior_data) {
    // Unusual mouse movements
    if (behavior_data.erratic_mouse_movements > 10) score += 15
    
    // Rapid answer patterns (possible copy-paste)
    if (behavior_data.rapid_answers > 5) score += 20
    
    // Inactive periods followed by sudden activity
    if (behavior_data.sudden_activity_spikes > 3) score += 10
    
    // Keyboard patterns
    if (behavior_data.unusual_keyboard_pattern) score += 10
  }
  
  // Analyze camera data if available
  if (camera_data) {
    // Face not detected frequently
    if (camera_data.face_not_detected_ratio > 0.3) score += 25
    
    // Multiple faces detected
    if (camera_data.multiple_faces_detected) score += 30
    
    // Looking away frequently
    if (camera_data.look_away_ratio > 0.5) score += 15
  }
  
  return Math.min(score, 100)
}

function getRiskLevel(score: number): string {
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Medium'
  if (score >= 20) return 'Low'
  return 'Minimal'
}

function getRecommendations(score: number): string[] {
  const recommendations: string[] = []
  
  if (score >= 80) {
    recommendations.push('Immediate manual review required')
    recommendations.push('Consider terminating exam session')
  } else if (score >= 60) {
    recommendations.push('Increase monitoring frequency')
    recommendations.push('Verify student identity')
  } else if (score >= 40) {
    recommendations.push('Monitor for additional suspicious behavior')
    recommendations.push('Document observations')
  }
  
  return recommendations
}

export { router as securityRoutes }
