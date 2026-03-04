import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { initDb } from './db'
import { authRoutes } from './routes/auth'
import { examRoutes } from './routes/exams'
import { adminRoutes } from './routes/admin'

const app = express()

initDb().catch(console.error)

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests' }
})
app.use('/api', limiter)

app.use('/api/auth', authRoutes)
app.use('/api', examRoutes)
app.use('/api/admin', adminRoutes)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Backend running on ${PORT}`))
