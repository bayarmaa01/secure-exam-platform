import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { initDb } from './db'
import { authRoutes } from './routes/auth'
import { examRoutes } from './routes/exams'
import { adminRoutes } from './routes/admin'
import { advancedExamRoutes } from './routes/advanced-exams'
import { analyticsRoutes } from './routes/analytics'
import { securityRoutes } from './routes/security'

const app = express()

// 🔥 IMPORTANT FIX (for proxies like Docker / Nginx)
app.set('trust proxy', 1)

// Middlewares
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests' }
})
app.use('/api', limiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api', examRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', advancedExamRoutes)
app.use('/api', analyticsRoutes)
app.use('/api', securityRoutes)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler:', err)
  res.status(500).json({ message: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.path)
  res.status(404).json({ message: 'Route not found' })
})

const PORT = process.env.PORT || 4000

// Start server only after DB is ready
async function start() {
  try {
    await initDb()
    console.log('Database connected')

    const server = app.listen(PORT, () => {
      console.log(`Backend running on ${PORT}`)
    })

    // Handle server errors
    server.on('error', (err: any) => {
      console.error('Server error:', err)
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`)
      }
      process.exit(1)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully')
      server.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    })

  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

// Export app for testing
export { app }