import { Router } from 'express'
import { pool } from '../db'
import { auth, AuthRequest } from '../middleware/auth'
import { getUserNotifications, markNotificationRead } from '../services/notifications'

const router = Router()

// Get user notifications
router.get('/notifications', auth, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const notifications = await getUserNotifications(req.user!.id, limit)
    
    res.json(notifications)
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Mark notification as read
router.post('/notifications/:id/read', auth, async (req: AuthRequest, res) => {
  try {
    const notificationId = req.params.id
    await markNotificationRead(notificationId, req.user!.id)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get unread notification count
router.get('/notifications/unread/count', auth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
      [req.user!.id]
    )
    
    res.json({ count: parseInt(result.rows[0].count) })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export { router as notificationRoutes }
