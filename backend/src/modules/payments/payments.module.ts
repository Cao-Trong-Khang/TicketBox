import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { getPaymentGatewayConfig } from '../../config/app.config';
import { RbacModule } from '../rbac/rbac.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { PaymentFactory } from './payment.factory';
import { PaymentsController, PaymentWebhooksController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { VnpayProvider } from './providers/vnpay.provider';
import { MomoProvider } from './providers/momo.provider';
import { DeterministicBehavior, DeterministicPaymentProvider } from './providers/deterministic-payment.provider';
import { OrdersModule } from '../orders/orders.module';
import { PaymentObservabilityService } from './payment-observability.service';

@Module({
  imports: [PrismaModule, RbacModule, RateLimitModule, OrdersModule],
  controllers: [PaymentsController, PaymentWebhooksController],
  providers: [PaymentsService, PaymentObservabilityService, RedisCircuitBreakerService, PaymentReconciliationService, {
    provide: PaymentFactory,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const config = getPaymentGatewayConfig(configService);
      const vnpayConfig = { name: 'vnpay' as const, ...config.vnpay };
      const momoConfig = { name: 'momo' as const, ...config.momo };
      const providers = [
        new VnpayProvider({ config: vnpayConfig }),
        new MomoProvider({ config: momoConfig }),
      ];
      const delayMs = Number(configService.get('PAYMENT_DEMO_DELAY_MS', 0));
      return new PaymentFactory(providers.map((provider) => {
        const behavior = configService.get<string>('PAYMENT_DEMO_' + provider.name.toUpperCase() + '_BEHAVIOR', 'off');
        if (behavior === 'off') return provider;
        if (!['success', 'failure', 'pending', 'timeout', 'outage'].includes(behavior)) {
          throw new Error('Invalid deterministic payment behavior for ' + provider.name);
        }
        const runtimeConfig = provider.name === 'vnpay' ? vnpayConfig : momoConfig;
        return new DeterministicPaymentProvider(provider, runtimeConfig, behavior as DeterministicBehavior, delayMs);
      }));
    },
  }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
