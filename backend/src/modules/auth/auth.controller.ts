import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser, AuthProfile } from './types';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    keyPrefix: 'auth-register',
    limit: 3,
    ttlSeconds: 15 * 60,
    identity: 'ip',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    keyPrefix: 'auth-login',
    limit: 5,
    ttlSeconds: 15 * 60,
    identity: 'ip',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest): Promise<AuthProfile> {
    return this.authService.getProfile(request.user.id, request.user.email);
  }
}
