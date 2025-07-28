const redis = require('redis');

class RedisClient {
  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    
    this.client = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          console.error('Redis max retry attempts reached');
          return undefined;
        }
        // Reconnect after
        return Math.min(options.attempt * 100, 3000);
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    this.client.on('end', () => {
      console.log('❌ Redis connection ended');
    });
  }

  async connect() {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
    } catch (error) {
      console.error('Redis connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect();
      }
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }

  async ping() {
    try {
      return await this.client.ping();
    } catch (error) {
      console.error('Redis ping error:', error);
      return null;
    }
  }

  // Session management
  async setSession(token, userData, expireInSeconds = 7200) {
    try {
      await this.client.setEx(`session:${token}`, expireInSeconds, JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error('Error setting session:', error);
      return false;
    }
  }

  async getSession(token) {
    try {
      const data = await this.client.get(`session:${token}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async deleteSession(token) {
    try {
      await this.client.del(`session:${token}`);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  // URL caching
  async cacheUrl(shortCode, longUrl, expireInSeconds = 3600) {
    try {
      await this.client.setEx(`url:${shortCode}`, expireInSeconds, longUrl);
      return true;
    } catch (error) {
      console.error('Error caching URL:', error);
      return false;
    }
  }

  async getCachedUrl(shortCode) {
    try {
      return await this.client.get(`url:${shortCode}`);
    } catch (error) {
      console.error('Error getting cached URL:', error);
      return null;
    }
  }

  // Click tracking
  async incrementClicks(shortCode) {
    try {
      const result = await this.client.incr(`clicks:${shortCode}`);
      // Set expiration if this is the first increment
      if (result === 1) {
        await this.client.expire(`clicks:${shortCode}`, 86400 * 30); // 30 days
      }
      return result;
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      return 0;
    }
  }

  async getClicks(shortCode) {
    try {
      const clicks = await this.client.get(`clicks:${shortCode}`);
      return clicks ? parseInt(clicks) : 0;
    } catch (error) {
      console.error('Error getting clicks:', error);
      return 0;
    }
  }

  // Rate limiting
  async checkRateLimit(key, maxRequests = 100, windowInSeconds = 3600) {
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowInSeconds);
      }
      return current <= maxRequests;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Allow request if Redis is down
      return true;
    }
  }

  // Health check
  async isHealthy() {
    try {
      const pong = await this.ping();
      return pong === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Batch operations for better performance
  async batchGetUrls(shortCodes) {
    try {
      const pipeline = this.client.multi();
      shortCodes.forEach(code => {
        pipeline.get(`url:${code}`);
      });
      return await pipeline.exec();
    } catch (error) {
      console.error('Error in batch get URLs:', error);
      return [];
    }
  }

  async batchGetClicks(shortCodes) {
    try {
      const pipeline = this.client.multi();
      shortCodes.forEach(code => {
        pipeline.get(`clicks:${code}`);
      });
      const results = await pipeline.exec();
      return results.map(result => result ? parseInt(result) : 0);
    } catch (error) {
      console.error('Error in batch get clicks:', error);
      return shortCodes.map(() => 0);
    }
  }

  // Clear expired cache entries
  async clearExpiredEntries() {
    try {
      // This is handled automatically by Redis TTL, but can be used for manual cleanup
      console.log('Redis TTL handles expired entries automatically');
      return true;
    } catch (error) {
      console.error('Error clearing expired entries:', error);
      return false;
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;