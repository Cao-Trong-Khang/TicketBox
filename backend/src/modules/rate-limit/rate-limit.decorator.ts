import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_METADATA_KEY } from './rate-limit.constants';
import { RateLimitConfig } from './rate-limit.types';

export function RateLimit(config: RateLimitConfig) {
  return SetMetadata(RATE_LIMIT_METADATA_KEY, config);
}
