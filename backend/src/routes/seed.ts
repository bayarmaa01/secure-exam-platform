import { Router } from 'express'
import { seedDatabase } from '../seed'
import { auth, AuthRequest, requireAdmin } from '../middleware/auth'

const router = Router()

// Admin: Seed database with test data
router.post('/seed',
  auth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      console.log('POST /api/seed - Starting database seeding...')
      
      await seedDatabase()
      
      console.log('POST /api/seed - Database seeding completed successfully')
      
      res.json({
        message: 'Database seeded successfully!',
        details: {
          teacher: 'teacher@test.com',
          students: 10,
          courses: 2,
          enrollments: 10,
          credentials_file: 'users_credentials.txt'
        }
      })
    } catch (error) {
      console.error('POST /api/seed - Error:', error)
      res.status(500).json({
        message: 'Database seeding failed',
        error: error.message
      })
    }
  }
)

export default router
