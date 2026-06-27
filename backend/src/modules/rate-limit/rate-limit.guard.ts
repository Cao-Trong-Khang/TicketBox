import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_EXCEEDED_MESSAGE,
  RATE_LIMIT_METADATA_KEY,
} from './rate-limit.constants';
import { RateLimitService } from './rate-limit.service';
import { RateLimitConfig, RateLimitIdentityInfo } from './rate-limit.types';

type RequestWithUser = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  user?: {
    id?: string;
  };
};

type ResponseWithHeader = {
  setHeader: (name: string, value: string | number) => void;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<RateLimitConfig>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!config) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const response = http.getResponse<ResponseWithHeader>();
    const identity = this.resolveIdentity(request, config);
    const result = await this.rateLimitService.checkLimit(config, identity);

    if (result.allowed) {
      return true;
    }

    if (result.retryAfterSeconds !== null && result.retryAfterSeconds >= 0) {
      response.setHeader('Retry-After', Math.max(0, result.retryAfterSeconds));
    }

    this.logger.warn(
      `Rate limit exceeded for ${config.keyPrefix} (${identity.type}:${this.rateLimitService.buildIdentityHash(identity)})`,
    );

    throw new HttpException(
      {
        statusCode: 429,
        message: RATE_LIMIT_EXCEEDED_MESSAGE,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      429,
    );
  }

  private resolveIdentity(
    request: RequestWithUser,
    config: RateLimitConfig,
  ): RateLimitIdentityInfo {
    if (config.identity === 'user_or_ip' && request.user?.id) {
      return {
        identifier: request.user.id,
        type: 'user',
      };
    }

    return {
      identifier: this.getClientIp(request),
      type: 'ip',
    };
  }

  private getClientIp(request: RequestWithUser): string {
    const forwardedForHeader = request.headers?.['x-forwarded-for'];
    const forwardedFor = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      const [firstIp] = forwardedFor.split(',');

      if (firstIp?.trim()) {
        return firstIp.trim();
      }
    }

    if (request.ip) {
      return request.ip;
    }

    if (request.socket?.remoteAddress) {
      return request.socket.remoteAddress;
    }

    return 'unknown';
  }
}
