export type RateLimitIdentity = 'ip' | 'user_or_ip';

export type RateLimitConfig = {
  keyPrefix: string;
  limit: number;
  ttlSeconds: number;
  identity: RateLimitIdentity;
};

export type RateLimitIdentityInfo = {
  identifier: string;
  type: 'ip' | 'user';
};

export type RateLimitCheckResult = {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number | null;
};
