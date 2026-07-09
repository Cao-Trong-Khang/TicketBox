import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentFactory } from './payment.factory';
import { VnpayProvider } from './providers/vnpay.provider';
import { MomoProvider } from './providers/momo.provider';
import { CircuitBreaker } from '../../shared/circuit-breaker/circuit-breaker';
import { getPaymentGatewayConfig } from '../../config/app.config';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PrismaService,
    {
      provide: PaymentFactory,
      useFactory: (configService: ConfigService) => {
        const paymentConfig = getPaymentGatewayConfig(configService);
        return new PaymentFactory([
          new VnpayProvider({
            circuitBreaker: new CircuitBreaker({
              failureThreshold: 3,
              resetTimeoutMs: 30000,
              halfOpenSuccessThreshold: 2,
            }),
            config: { name: 'vnpay', ...paymentConfig.vnpay },
          }),
          new MomoProvider({
            circuitBreaker: new CircuitBreaker({
              failureThreshold: 3,
              resetTimeoutMs: 30000,
              halfOpenSuccessThreshold: 2,
            }),
            config: { name: 'momo', ...paymentConfig.momo },
          }),
        ]);
      },
      inject: [ConfigService],
    },
  ],
})
export class PaymentsModule {}
