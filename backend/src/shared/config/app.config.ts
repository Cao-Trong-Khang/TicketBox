import { ConfigService } from '@nestjs/config';

export type HttpConfig = {
  port: number;
  frontendOrigins: string[];
};

export type PostgresConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export type RedisConfig = {
  host: string;
  port: number;
};

export type KafkaConfig = {
  brokers: string[];
};

export type PaymentGatewayProviderConfig = {
  paymentUrl: string;
  returnUrl: string;
  ipnUrl: string;
  hashSecret: string;
  tmnCode?: string;
  partnerCode?: string;
  accessKey?: string;
  webhookSecret: string;
};

export type PaymentGatewayConfig = {
  vnpay: PaymentGatewayProviderConfig;
  momo: PaymentGatewayProviderConfig;
};

export type EmailConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
};

export type PushNotificationConfig = {
  serverKey: string;
  projectId: string;
};

export type NotificationConfig = {
  email: EmailConfig;
  push: PushNotificationConfig;
};

export function getHttpConfig(configService: ConfigService): HttpConfig {
  return {
    port: readNumber(configService, 'PORT', 3000),
    frontendOrigins: readList(configService, 'FRONTEND_ORIGIN', ['http://localhost:5173']),
  };
}

export function getPostgresConfig(configService: ConfigService): PostgresConfig {
  return {
    host: configService.get<string>('POSTGRES_HOST', 'localhost'),
    port: readNumber(configService, 'POSTGRES_PORT', 5432),
    user: configService.get<string>('POSTGRES_USER', 'ticketbox'),
    password: configService.get<string>('POSTGRES_PASSWORD', 'ticketbox'),
    database: configService.get<string>('POSTGRES_DB', 'ticketbox'),
  };
}

export function getRedisConfig(configService: ConfigService): RedisConfig {
  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: readNumber(configService, 'REDIS_PORT', 6379),
  };
}

export function getKafkaConfig(configService: ConfigService): KafkaConfig {
  return {
    brokers: readList(configService, 'KAFKA_BROKERS', ['localhost:9092']),
  };
}

export function getPaymentGatewayConfig(configService: ConfigService): PaymentGatewayConfig {
  return {
    vnpay: {
      paymentUrl: configService.get<string>('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
      returnUrl: configService.get<string>('VNPAY_RETURN_URL', 'http://localhost:5173/payments/success'),
      ipnUrl: configService.get<string>('VNPAY_IPN_URL', 'http://localhost:3000/payments/webhook'),
      hashSecret: configService.get<string>('VNPAY_HASH_SECRET', 'vnpay-secret'),
      tmnCode: configService.get<string>('VNPAY_TMN_CODE', 'TICKETBOX'),
      webhookSecret: configService.get<string>('VNPAY_WEBHOOK_SECRET', 'vnpay-webhook-secret'),
    },
    momo: {
      paymentUrl: configService.get<string>('MOMO_URL', 'https://test-payment.momo.vn/v2/gateway/api/create'),
      returnUrl: configService.get<string>('MOMO_RETURN_URL', 'http://localhost:5173/payments/success'),
      ipnUrl: configService.get<string>('MOMO_IPN_URL', 'http://localhost:3000/payments/webhook'),
      hashSecret: configService.get<string>('MOMO_SECRET_KEY', 'momo-secret'),
      partnerCode: configService.get<string>('MOMO_PARTNER_CODE', 'MOMO'),
      accessKey: configService.get<string>('MOMO_ACCESS_KEY', 'momo-access-key'),
      webhookSecret: configService.get<string>('MOMO_WEBHOOK_SECRET', 'momo-webhook-secret'),
    },
  };
}

export function getNotificationConfig(configService: ConfigService): NotificationConfig {
  return {
    email: {
      host: configService.get<string>('EMAIL_HOST', 'localhost'),
      port: readNumber(configService, 'EMAIL_PORT', 1025),
      user: configService.get<string>('EMAIL_USER', ''),
      password: configService.get<string>('EMAIL_PASSWORD', ''),
      fromAddress: configService.get<string>('EMAIL_FROM', 'noreply@ticketbox.local'),
    },
    push: {
      serverKey: configService.get<string>('FCM_SERVER_KEY', ''),
      projectId: configService.get<string>('FCM_PROJECT_ID', 'ticketbox'),
    },
  };
}

function readNumber(configService: ConfigService, key: string, fallback: number): number {
  const rawValue = configService.get<string | number>(key, fallback);
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric environment value for ${key}`);
  }

  return parsed;
}

function readList(configService: ConfigService, key: string, fallback: string[]): string[] {
  const rawValue = configService.get<string>(key);

  if (!rawValue) {
    return fallback;
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
