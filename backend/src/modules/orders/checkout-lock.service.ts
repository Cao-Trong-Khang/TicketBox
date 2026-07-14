import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

@Injectable()
export class CheckoutLockService {
  constructor(private readonly redis: RedisCacheService) {}
  async withLocks<T>(scopes: string[], operation: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const keys = [...new Set(scopes)].sort().map((scope) => `ticketbox:checkout:lock:${scope}`);
    const acquired: string[] = [];
    try {
      for (const key of keys) {
        let result: unknown;
        try { result = await this.redis.setStrict(key, token, 'PX', 10_000, 'NX'); }
        catch { throw new ServiceUnavailableException({ code: 'CHECKOUT_COORDINATION_UNAVAILABLE', retryAfterSeconds: 2 }); }
        if (result !== 'OK') throw new ServiceUnavailableException({ code: 'CHECKOUT_BUSY', retryAfterSeconds: 1 });
        acquired.push(key);
      }
      return await operation();
    } finally {
      for (const key of acquired.reverse()) {
        try { await this.redis.evalStrict("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", [key], [token]); } catch { /* lease expiry is safe */ }
      }
    }
  }
}
