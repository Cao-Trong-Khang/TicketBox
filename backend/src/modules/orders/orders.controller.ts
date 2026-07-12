import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderRequestDto } from './dto/create-order.request.dto';
import { CreateOrderResponseDto } from './dto/create-order.response.dto';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { AuthenticatedUser } from '../auth/types';
import { OrderHistoryItemDto } from './dto/order-history.response.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getOrderHistory(@Req() req: Request): Promise<OrderHistoryItemDto[]> {
    const userId = (req.user as AuthenticatedUser).id;
    return this.ordersService.getOrderHistory(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    keyPrefix: 'orders-create',
    limit: 5,
    ttlSeconds: 5 * 60,
    identity: 'user_or_ip',
  })
  @HttpCode(200)
  async createOrder(
    @Req() req: Request,
    @Body() dto: CreateOrderRequestDto,
  ): Promise<CreateOrderResponseDto> {
    const userId = (req.user as any).id;
    return this.ordersService.createOrder(userId, dto);
  }
}
