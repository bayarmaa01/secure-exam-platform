import { Router } from 'express'
import { pool } from '../db'

const router = Router()

// Debug endpoint to publish exam
router.post('/publish-exam/:examId', async (req, res) => {
  try {
    const { examId } = req.params
    
    console.log(`[DEBUG] Publishing exam: ${examId}`)
    
    const result = await pool.query(
      `UPDATE exams 
       SET is_published = true, status = 'published', updated_at = NOW()
       WHERE id = $1 
       RETURNING id, title, status, is_published`,
      [examId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found' })
    }
    
    console.log(`[DEBUG] Exam published successfully:`, result.rows[0])
    
    res.json({
      success: true,
      message: 'Exam published successfully',
      exam: result.rows[0]
    })
  } catch (error) {
    console.error('[DEBUG] Error publishing exam:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Debug endpoint to check exam status
router.get('/exam-status/:examId', async (req, res) => {
  try {
    const { examId } = req.params
    
    const result = await pool.query(
      `SELECT id, title, status, is_published, start_time, end_time 
       FROM exams WHERE id = $1`,
      [examId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found' })
    }
    
    res.json({
      exam: result.rows[0],
      now: new Date().toISOString()
    })
  } catch (error) {
    console.error('[DEBUG] Error checking exam status:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
