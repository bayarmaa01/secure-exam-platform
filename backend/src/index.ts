import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
// import rateLimit from 'express-rate-limit' // DISABLED
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { initDb } from './db'
import { collectDefaultMetrics, register, Counter, Histogram, Gauge } from 'prom-client'
import { authRoutes } from './routes/auth'
import { examUnifiedRoutes } from './routes/exam-unified'
import { adminRoutes } from './routes/admin'
import { analyticsRoutes } from './routes/analytics'
import { securityRoutes } from './routes/security'
import { resultsRoutes } from './routes/results'
import { notificationRoutes } from './routes/notifications'
import coursesRouter from './routes/courses'
import questionsRouter from './routes/questions'
// import attemptsRouter from './routes/attempts' // Using attempts-api instead
import { examRoutes } from './routes/exams'
import seedRouter from './routes/seed'
import { websocketConnections } from './metrics/examMetrics'
import { setIO } from './utils/socketHelper'
import { teacherRoutes } from './routes/teacher'
import { examSessionRoutes } from './routes/examSessions'
import { studentRoutes } from './routes/student'
import { warningsUnifiedRoutes } from './routes/warnings-unified'
import { monitoringRoutes } from './routes/monitoring'
import { aiProctoringRoutes } from './routes/ai-proctoring'
import { attemptsApiRoutes } from './routes/attempts-api'
import { analyticsApiRoutes } from './routes/analytics-api'
import proctoringRoutes from './routes/proctoring'
import testRoutes from './routes/test-results'
import debugExamRoutes from './routes/debug-exam'
import { startExamStatusUpdater } from './jobs/examStatusUpdater'
import { initRedis } from './redis'

// Prometheus metrics
collectDefaultMetrics({ register })

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
})

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
})

// Exam session metrics
const activeExamSessions = new Gauge({
  name: 'exam_sessions_active',
  help: 'Number of active exam sessions',
  registers: [register]
})

const examSubmissionsTotal = new Counter({
  name: 'exam_submissions_total',
  help: 'Total number of exam submissions',
  labelNames: ['status'],
  registers: [register]
})

// Additional metrics for Grafana dashboard
const examActiveTotal = new Counter({
  name: 'exam_active_total',
  help: 'Total number of active exams currently running',
  registers: [register]
})

const examStartedTotal = new Counter({
  name: 'exam_started_total',
  help: 'Total number of exams started',
  registers: [register]
})

const examViolationsTotal = new Counter({
  name: 'exam_violations_total',
  help: 'Total number of exam violations detected',
  labelNames: ['type', 'exam_id', 'course_id', 'user_id'],
  registers: [register]
})

const suspiciousStudentsTotal = new Counter({
  name: 'suspicious_students_total',
  help: 'Total students marked as suspicious',
  registers: [register]
})

const cheatingDetectedTotal = new Counter({
  name: 'cheating_detected_total',
  help: 'Total cheating incidents detected',
  registers: [register]
})

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3005',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
})

// 🔥 IMPORTANT FIX (for proxies like Docker / Nginx)
app.set('trust proxy', 1)

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3005',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
].filter(Boolean)

// CORS middleware configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}

// Middlewares
app.use(helmet())
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

// Request logging and metrics middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  
  const start = Date.now()
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    const route = req.route?.path || req.path
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration)
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc()
  })
  
  next()
})

// Rate limiting - DISABLED for testing
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: { message: 'Too many requests' }
// })
// app.use('/api', limiter)

// Debug middleware to track all requests
app.use('/api', (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Headers:`, {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'PRESENT' : 'MISSING',
    'content-length': req.headers['content-length']
  })
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Body:`, req.body)
  next()
})

// Debug publish endpoint
app.post('/api/debug/publish-exam/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { pool } = await import('./db')
    
    const result = await pool.query(
      `UPDATE exams 
       SET is_published = true, status = 'published', updated_at = NOW()
       WHERE id = $1 
       RETURNING id, title, status, is_published`,
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found' })
    }
    
    console.log(`✅ DEBUG: Exam ${id} published`)
    res.json({
      success: true,
      message: 'Exam published successfully',
      exam: result.rows[0]
    })
  } catch (error) {
    console.error('DEBUG: Error publishing exam:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api', attemptsApiRoutes)
app.use('/api', examUnifiedRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', analyticsRoutes)
app.use('/api', securityRoutes)
app.use('/api/results', resultsRoutes)
app.use('/api', notificationRoutes)
app.use('/api', coursesRouter)
app.use('/api', teacherRoutes)
app.use('/api', studentRoutes)
app.use('/api', examSessionRoutes)
app.use('/api', examRoutes)
app.use('/api', questionsRouter)
// app.use('/api', attemptsRouter) // Using attempts-api instead
app.use('/api', seedRouter)
app.use('/api', warningsUnifiedRoutes)
app.use('/api', monitoringRoutes)
app.use('/api/ai', aiProctoringRoutes)
app.use('/api', analyticsApiRoutes)
app.use('/api', proctoringRoutes)
app.use('/api/test', testRoutes)
app.use('/api/debug', debugExamRoutes)

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/version.json', (_, res) => {
  res.json({
    version: '1.0.0',
    name: 'Secure Exam Platform',
    buildTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      authentication: true,
      proctoring: true,
      metrics: true,
      websocket: true
    }
  })
})

// Prometheus metrics endpoint
app.get('/metrics', async (_, res) => {
  try {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  } catch (error) {
    res.status(500).end(error.message)
  }
})

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler:', err)
  console.error('Request URL:', req.url)
  console.error('Request method:', req.method)
  console.error('Request body:', req.body)
  console.error('Error stack:', err.stack)
  res.status(500).json({ message: 'Internal server error', error: err.message })
})

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.path)
  res.status(404).json({ message: 'Route not found' })
})

const PORT = process.env.PORT || 4005

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)
  
  // Track WebSocket connections
  websocketConnections.inc({ type: 'total' })
  
  // Join user to their personal room
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`)
    console.log(`User ${userId} joined their room`)
  })
  
  // Join teachers to their exam rooms
  socket.on('join_exam_room', (examId) => {
    socket.join(`exam_${examId}`)
    console.log(`User joined exam room: ${examId}`)
  })
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    websocketConnections.dec({ type: 'total' })
  })
})

// Make io available to routes
app.set('io', io)

// Set IO instance for helper functions
setIO(io)

// Start server only after DB is ready
async function start() {
  try {
    console.log('Initializing database connection...')
    await initDb()
    console.log('Database connected successfully')

    // Initialize Redis
    console.log('Initializing Redis connection...')
    initRedis()
    console.log('Redis initialization completed')

    // Start background jobs
    console.log('Starting background jobs...')
    startExamStatusUpdater()

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`)
      console.log(`WebSocket server running on port ${PORT}`)
      console.log(`Health check available at http://localhost:${PORT}/health`)
    })

    // Handle server errors
    server.on('error', (err: NodeJS.ErrnoException) => {
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

// Export app and metrics for testing
export { 
  app, 
  activeExamSessions, 
  examSubmissionsTotal,
  examActiveTotal,
  examStartedTotal,
  examViolationsTotal,
  suspiciousStudentsTotal,
  cheatingDetectedTotal
}