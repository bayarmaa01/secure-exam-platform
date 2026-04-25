import { Request, Response, NextFunction } from 'express'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
  details?: unknown
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    code: err.code,
    details: err.details,
    timestamp: new Date().toISOString()
  })

  // Default error response
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'

  // Handle specific error types
  if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409
    message = 'Resource already exists'
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400
    message = 'Invalid reference to related resource'
  } else if (err.code === '23502') { // PostgreSQL not null violation
    statusCode = 400
    message = 'Required field is missing'
  } else if (err.code === '42703') { // PostgreSQL undefined column
    statusCode = 500
    message = 'Database schema error'
    console.error('[SCHEMA ERROR] Column does not exist:', err.details)
  } else if (err.code === 'ECONNRESET') {
    statusCode = 503
    message = 'Service temporarily unavailable'
  } else if (err.code === 'ENOTFOUND') {
    statusCode = 503
    message = 'Service temporarily unavailable'
  }

  // JWT specific errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid authentication token'
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Authentication token expired'
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation failed'
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details
    })
  })
}

export function notFoundHandler(req: Request, res: Response) {
  console.warn(`[404] ${req.method} ${req.path} - Route not found`)
  res.status(404).json({
    success: false,
    message: 'Route not found',
    timestamp: new Date().toISOString()
  })
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
