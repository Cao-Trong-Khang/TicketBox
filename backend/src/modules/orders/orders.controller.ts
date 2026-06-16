import {
  Controller,
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

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async createOrder(
    @Req() req: Request,
    @Body() dto: CreateOrderRequestDto,
  ): Promise<CreateOrderResponseDto> {
    const userId = (req.user as any).id;
    return this.ordersService.createOrder(userId, dto);
  }
}
