import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentFactory } from './payment.factory';
import type { CreatePaymentRequest, CreatePaymentResponse } from './payment.types';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentFactory: PaymentFactory) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createPayment(@Body() request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const provider = this.paymentFactory.getProvider(request.provider);
    return provider.createPayment(request);
  }
}
