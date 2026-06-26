import type { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker';
import type { PaymentProviderName } from '../payment.types';

export type PaymentProviderRuntimeConfig = {
  name: PaymentProviderName;
  paymentUrl: string;
  webhookSecret: string;
  returnUrl: string;
  ipnUrl: string;
  tmnCode?: string;
  partnerCode?: string;
  accessKey?: string;
  hashSecret: string;
};

export type PaymentProviderDependencies = {
  circuitBreaker: CircuitBreaker;
  config: PaymentProviderRuntimeConfig;
};
