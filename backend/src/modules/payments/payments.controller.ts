import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.ticketPurchase)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('initiate') @UseGuards(RateLimitGuard) @RateLimit({ keyPrefix: 'payments-initiate', limit: 10, ttlSeconds: 300, identity: 'user_or_ip' })
  @HttpCode(HttpStatus.OK)
  initiate(@Req() req: Request, @Body() dto: InitiatePaymentDto) { return this.payments.initiate((req.user as AuthenticatedUser).id, dto); }
  @Get('providers') providers() { return this.payments.getAvailability(); }
  @Get(':paymentId') status(@Req() req: Request, @Param('paymentId') id: string) { return this.payments.getStatus((req.user as AuthenticatedUser).id, id); }
}

@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('vnpay')
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: 'payments-webhook-vnpay', limit: 120, ttlSeconds: 60, identity: 'ip' })
  @HttpCode(HttpStatus.OK)
  vnpay(@Body() body: Record<string, unknown>) { return this.payments.handleWebhook('vnpay', body); }

  @Post('momo')
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: 'payments-webhook-momo', limit: 120, ttlSeconds: 60, identity: 'ip' })
  @HttpCode(HttpStatus.OK)
  momo(@Body() body: Record<string, unknown>) { return this.payments.handleWebhook('momo', body); }
}
