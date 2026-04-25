import Redis from 'ioredis'

let redisClient: Redis | null = null

export function initRedis(): Redis | null {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
    console.log(`[REDIS] Connecting to Redis at: ${redisUrl}`)
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })

    redisClient.on('connect', () => {
      console.log('[REDIS] Connected successfully')
    })

    redisClient.on('error', (err) => {
      console.error('[REDIS] Connection error:', err)
    })

    redisClient.on('close', () => {
      console.log('[REDIS] Connection closed')
    })

    return redisClient
  } catch (error) {
    console.error('[REDIS] Failed to initialize Redis client:', error)
    return null
  }
}

export function getRedisClient(): Redis | null {
  if (!redisClient) {
    return initRedis()
  }
  return redisClient
}

export async function setRedisKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    console.warn('[REDIS] Redis not available, skipping set operation')
    return
  }

  try {
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, value)
    } else {
      await client.set(key, value)
    }
    console.log(`[REDIS] Set key: ${key}`)
  } catch (error) {
    console.error(`[REDIS] Error setting key ${key}:`, error)
  }
}

export async function getRedisKey(key: string): Promise<string | null> {
  const client = getRedisClient()
  if (!client) {
    console.warn('[REDIS] Redis not available, returning null')
    return null
  }

  try {
    const value = await client.get(key)
    console.log(`[REDIS] Get key: ${key}, found: ${value !== null}`)
    return value
  } catch (error) {
    console.error(`[REDIS] Error getting key ${key}:`, error)
    return null
  }
}

export async function deleteRedisKey(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    console.warn('[REDIS] Redis not available, skipping delete operation')
    return
  }

  try {
    await client.del(key)
    console.log(`[REDIS] Deleted key: ${key}`)
  } catch (error) {
    console.error(`[REDIS] Error deleting key ${key}:`, error)
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('[REDIS] Connection closed')
  }
}
