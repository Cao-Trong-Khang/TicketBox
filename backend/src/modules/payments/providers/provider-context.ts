import type { PaymentProviderName } from '../payment.types';

export type PaymentProviderRuntimeConfig = {
  name: PaymentProviderName;
  paymentUrl: string;
  queryUrl: string;
  webhookSecret: string;
  returnUrl: string;
  ipnUrl: string;
  tmnCode?: string;
  partnerCode?: string;
  accessKey?: string;
  hashSecret: string;
  timeoutMs: number;
  queryTimeoutMs: number;
};

export type PaymentProviderDependencies = {
  config: PaymentProviderRuntimeConfig;
};
