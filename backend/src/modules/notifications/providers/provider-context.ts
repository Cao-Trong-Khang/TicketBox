import type { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker';

export type EmailProviderConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
};

export type PushProviderConfig = {
  serverKey: string;
  projectId: string;
};

export type EmailProviderDependencies = {
  circuitBreaker: CircuitBreaker;
  config: EmailProviderConfig;
};

export type PushProviderDependencies = {
  circuitBreaker: CircuitBreaker;
  config: PushProviderConfig;
};
