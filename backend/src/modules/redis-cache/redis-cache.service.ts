import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL', DEFAULT_REDIS_URL);

    this.redis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.redis.on('error', (error) => {
      this.logger.warn(`Redis cache connection error: ${error.message}`);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnected();
      return await this.redis.get(key);
    } catch (error) {
      this.warn('get', key, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch (error) {
      this.warn('set', key, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.del(key);
    } catch (error) {
      this.warn('del', key, error);
    }
  }

  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    try {
      await this.ensureConnected();
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, ttlSeconds);
      }

      return count;
    } catch (error) {
      this.warn('increment', key, error);
      return null;
    }
  }

  async getTtlSeconds(key: string): Promise<number | null> {
    try {
      await this.ensureConnected();
      const ttl = await this.redis.ttl(key);

      if (ttl < 0) {
        return null;
      }

      return ttl;
    } catch (error) {
      this.warn('ttl', key, error);
      return null;
    }
  }

  onModuleDestroy(): void {
    if (this.redis.status !== 'end') {
      this.redis.disconnect();
    }
  }

  private warn(operation: string, key: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown Redis error';
    this.logger.warn(`Redis cache ${operation} failed for key "${key}": ${message}`);
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      await this.redis.connect();
    }
  }
}
