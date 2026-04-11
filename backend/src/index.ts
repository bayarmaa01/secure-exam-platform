import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { initDb } from './db'
import { collectDefaultMetrics, register, Counter, Histogram, Gauge } from 'prom-client'
import { authRoutes } from './routes/auth'
import { examRoutes } from './routes/exams'
import { adminRoutes } from './routes/admin'
import { advancedExamRoutes } from './routes/advanced-exams'
import { analyticsRoutes } from './routes/analytics'
import { securityRoutes } from './routes/security'
import { resultsRoutes } from './routes/results'
import { notificationRoutes } from './routes/notifications'

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

const activeExamSessions = new Gauge({
  name: 'exam_sessions_active',
  help: 'Number of active exam sessions',
  registers: [register]
})

const suspiciousEventsTotal = new Counter({
  name: 'suspicious_events_total',
  help: 'Total number of suspicious proctoring events',
  labelNames: ['event_type'],
  registers: [register]
})

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
})

// 🔥 IMPORTANT FIX (for proxies like Docker / Nginx)
app.set('trust proxy', 1)

// Middlewares
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }))
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
app.use('/api/results', resultsRoutes)
app.use('/api', notificationRoutes)

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

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

const PORT = process.env.PORT || 4000

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)
  
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
  })
})

// Make io available to routes
app.set('io', io)

// Start server only after DB is ready
async function start() {
  try {
    await initDb()
    console.log('Database connected')

    server.listen(PORT, () => {
      console.log(`Backend running on ${PORT}`)
      console.log(`WebSocket server running on ${PORT}`)
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
export { app, activeExamSessions, suspiciousEventsTotal }