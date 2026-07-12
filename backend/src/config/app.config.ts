import { ConfigService } from '@nestjs/config';

export type HttpConfig = { port: number; frontendOrigins: string[] };
export type PostgresConfig = { host: string; port: number; user: string; password: string; database: string };
export type RedisConfig = { host: string; port: number };
export type KafkaConfig = { brokers: string[] };
export type JwtConfig = { accessSecret: string; accessTokenTtl: string };
export type BannersConfig = { maxFileSize: number; bucket: string; cacheMaxAge: number };

export type ArtistBioConfig = {
  topic: string;
  groupId: string;
  minioEndpoint: string;
  minioPort: number;
  minioUseSsl: boolean;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
  minioTimeoutMs: number;
  aiProvider: 'mock' | 'openai' | 'gemini';
  aiModel: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiTimeoutMs: number;
  aiRateLimitRetryMs: number;
  aiTextMaxChars: number;
  pdfMinTextChars: number;
};

export type CheckInQrConfig = {
  issuer: string;
  hmacSecret: string;
};

export type PaymentGatewayConfig = {
  vnpay: { paymentUrl: string; returnUrl: string; ipnUrl: string; hashSecret: string; tmnCode: string; webhookSecret: string };
  momo: { paymentUrl: string; returnUrl: string; ipnUrl: string; hashSecret: string; partnerCode: string; accessKey: string; webhookSecret: string };
};

export type NotificationConfig = {
  email: { host: string; port: number; user: string; password: string; fromAddress: string };
  push: { serverKey: string; projectId: string };
};

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
            host: configService.get<string>('EMAIL_HOST') || configService.get<string>('MAIL_HOST') || 'localhost',
            port: Number(configService.get<string>('EMAIL_PORT') || configService.get<string>('MAIL_PORT') || '587'),
            user: configService.get<string>('EMAIL_USER') || configService.get<string>('MAIL_USER') || '',
            password: configService.get<string>('EMAIL_PASSWORD') || configService.get<string>('MAIL_PASSWORD') || '',
            fromAddress: configService.get<string>('EMAIL_FROM') || configService.get<string>('MAIL_FROM') || 'noreply@ticketbox.local',
        },
        push: {
            serverKey: configService.get<string>('FCM_SERVER_KEY', ''),
            projectId: configService.get<string>('FCM_PROJECT_ID', 'ticketbox'),
        },
    };
}

export function getHttpConfig(configService: ConfigService): HttpConfig {
  return { port: readNumber(configService, 'PORT', 3000), frontendOrigins: readList(configService, 'FRONTEND_ORIGIN', ['http://localhost:5173']) };
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
  return { host: configService.get<string>('REDIS_HOST', 'localhost'), port: readNumber(configService, 'REDIS_PORT', 6379) };
}

export function getKafkaConfig(configService: ConfigService): KafkaConfig {
  return { brokers: readList(configService, 'KAFKA_BROKERS', ['localhost:9092']) };
}

export function getArtistBioConfig(configService: ConfigService): ArtistBioConfig {
  const provider = configService.get<string>('AI_PROVIDER', 'mock').toLowerCase();
  if (!['mock', 'openai', 'gemini'].includes(provider)) throw new Error(`Invalid AI_PROVIDER value: ${provider}`);

  return {
    topic: readRequired(configService, 'AI_BIO_TOPIC', 'ai.bio.requested'),
    groupId: readRequired(configService, 'AI_BIO_GROUP_ID', 'ticketbox-ai-bio-worker'),
    minioEndpoint: readRequired(configService, 'MINIO_ENDPOINT', 'localhost'),
    minioPort: readPositiveNumber(configService, 'MINIO_PORT', 9000),
    minioUseSsl: readBoolean(configService, 'MINIO_USE_SSL', false),
    minioAccessKey: readRequired(configService, 'MINIO_ACCESS_KEY', 'ticketbox'),
    minioSecretKey: readRequired(configService, 'MINIO_SECRET_KEY', 'ticketbox-minio-secret'),
    minioBucket: readRequired(configService, 'MINIO_BUCKET', 'artist-documents'),
    minioTimeoutMs: readPositiveNumber(configService, 'MINIO_TIMEOUT_MS', 10_000),
    aiProvider: provider as ArtistBioConfig['aiProvider'],
    aiModel: readRequired(configService, 'AI_MODEL', 'mock-biography-v1'),
    aiApiKey: configService.get<string>('AI_API_KEY', ''),
    aiBaseUrl: configService.get<string>('AI_BASE_URL', ''),
    aiTimeoutMs: readPositiveNumber(configService, 'AI_TIMEOUT_MS', 30_000),
    aiRateLimitRetryMs: readPositiveNumber(configService, 'AI_RATE_LIMIT_RETRY_MS', 60_000),
    aiTextMaxChars: readPositiveNumber(configService, 'AI_TEXT_MAX_CHARS', 4_000),
    pdfMinTextChars: readPositiveNumber(configService, 'PDF_MIN_TEXT_CHARS', 50),
  };
}

export function getCheckInQrConfig(configService: ConfigService): CheckInQrConfig {
  const hmacSecret = configService.get<string>('CHECK_IN_QR_HMAC_SECRET', '');

  if (!hmacSecret.trim()) {
    throw new Error('Invalid empty environment value for CHECK_IN_QR_HMAC_SECRET');
  }

  if (hmacSecret.trim().length < 32) {
    throw new Error('CHECK_IN_QR_HMAC_SECRET must be at least 32 characters long');
  }

  const issuer = configService.get<string>('CHECK_IN_QR_ISSUER', 'ticketbox');

  if (!issuer.trim()) {
    throw new Error('Invalid empty environment value for CHECK_IN_QR_ISSUER');
  }

  return {
    issuer: issuer.trim(),
    hmacSecret: hmacSecret.trim(),
  };
}

export function getJwtConfig(configService: ConfigService): JwtConfig {
  const accessSecret = configService.get<string>('JWT_ACCESS_SECRET', 'local-development-jwt-secret');
  if (!accessSecret.trim()) throw new Error('Invalid empty environment value for JWT_ACCESS_SECRET');
  return { accessSecret, accessTokenTtl: configService.get<string>('JWT_ACCESS_TOKEN_TTL', '1h') };
}

export function getBannersConfig(configService: ConfigService): BannersConfig {
  return {
    maxFileSize: readPositiveNumber(configService, 'BANNERS_MAX_FILE_SIZE', 5_242_880),
    bucket: readRequired(configService, 'BANNERS_BUCKET', 'concert-banners'),
    cacheMaxAge: readPositiveNumber(configService, 'BANNERS_CACHE_MAX_AGE', 86_400),
  };
}

function readNumber(configService: ConfigService, key: string, fallback: number): number {
  const parsed = Number(configService.get<string | number>(key, fallback));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric environment value for ${key}`);
  return parsed;
}

function readPositiveNumber(configService: ConfigService, key: string, fallback: number): number {
  const value = readNumber(configService, key, fallback);
  if (value <= 0) throw new Error(`Invalid non-positive environment value for ${key}`);
  return value;
}

function readBoolean(configService: ConfigService, key: string, fallback: boolean): boolean {
  const raw = configService.get<string | boolean>(key, fallback);
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Invalid boolean environment value for ${key}`);
}

function readRequired(configService: ConfigService, key: string, fallback: string): string {
  const value = configService.get<string>(key, fallback).trim();
  if (!value) throw new Error(`Invalid empty environment value for ${key}`);
  return value;
}

function readList(configService: ConfigService, key: string, fallback: string[]): string[] {
  const rawValue = configService.get<string>(key);
  if (!rawValue) return fallback;
  return rawValue.split(',').map((value) => value.trim()).filter(Boolean);
}
