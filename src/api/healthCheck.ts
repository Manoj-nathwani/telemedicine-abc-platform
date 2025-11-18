import type { RootApi, HealthCheckApi } from 'wasp/server/api'
import { BRAND_NAME } from '../constants'
import { prisma } from 'wasp/server'
import { now, format } from '../utils/dateTime'

export const rootHandler: RootApi = async (_req, res) => {
  if (!process.env.NODE_ENV) {
    throw new Error('NODE_ENV environment variable is not set')
  }

  const welcomeInfo = {
    message: `${BRAND_NAME} Server API`,
    status: 'running',
    timestamp: format(now()),
    environment: process.env.NODE_ENV
  }

  res.status(200).json(welcomeInfo)
}

export const healthCheckHandler: HealthCheckApi = async (_req, res) => {
  if (!process.env.NODE_ENV) {
    throw new Error('NODE_ENV environment variable is not set')
  }

  // Test database connection
  let databaseStatus: string
  try {
    await prisma.$queryRaw`SELECT 1`
    databaseStatus = 'connected'
  } catch (error) {
    databaseStatus = 'disconnected'
    console.error('Database connection check failed:', error)
  }

  const healthInfo = {
    status: databaseStatus === 'connected' ? 'healthy' : 'unhealthy',
    service: `${BRAND_NAME} Server`,
    timestamp: format(now()),
    environment: process.env.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    database: databaseStatus
  }

  const statusCode = databaseStatus === 'connected' ? 200 : 503
  res.status(statusCode).json(healthInfo)
}