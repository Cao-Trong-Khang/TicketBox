import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtConfig } from '../../config/app.config';
import { AuthenticatedUser, JwtPayload } from './types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtConfig = getJwtConfig(configService);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.user_id || !Array.isArray(payload.roles)) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    return {
      id: payload.user_id,
      roles: payload.roles,
    };
  }
}
