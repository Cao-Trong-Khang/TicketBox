import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import {
  RateLimitCheckResult,
  RateLimitConfig,
  RateLimitIdentityInfo,
} from './rate-limit.types';

@Injectable()
export class RateLimitService {
  constructor(private readonly redisCache: RedisCacheService) {}

  async checkLimit(
    config: RateLimitConfig,
    identity: RateLimitIdentityInfo,
  ): Promise<RateLimitCheckResult> {
    const key = this.buildKey(config.keyPrefix, identity);
    const count = await this.redisCache.incrementWithTtl(key, config.ttlSeconds);

    if (count === null) {
      return {
        allowed: true,
        count: 0,
        retryAfterSeconds: null,
      };
    }

    if (count <= config.limit) {
      return {
        allowed: true,
        count,
        retryAfterSeconds: null,
      };
    }

    return {
      allowed: false,
      count,
      retryAfterSeconds: await this.redisCache.getTtlSeconds(key),
    };
  }

  buildIdentityHash(identity: RateLimitIdentityInfo): string {
    return createHash('sha256')
      .update(`${identity.type}:${identity.identifier}`)
      .digest('hex')
      .slice(0, 12);
  }

  private buildKey(prefix: string, identity: RateLimitIdentityInfo): string {
    const identityHash = createHash('sha256')
      .update(`${identity.type}:${identity.identifier}`)
      .digest('hex');

    return `rate-limit:${prefix}:${identity.type}:${identityHash}`;
  }
}
