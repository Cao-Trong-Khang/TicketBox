import { ConfigService } from '@nestjs/config';

export type HttpConfig = { port: number; frontendOrigins: string[] };
export type PostgresConfig = { host: string; port: number; user: string; password: string; database: string };
export type RedisConfig = { host: string; port: number };
export type KafkaConfig = { brokers: string[] };
export type JwtConfig = { accessSecret: string; accessTokenTtl: string };

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

export function getJwtConfig(configService: ConfigService): JwtConfig {
  const accessSecret = configService.get<string>('JWT_ACCESS_SECRET', 'local-development-jwt-secret');
  if (!accessSecret.trim()) throw new Error('Invalid empty environment value for JWT_ACCESS_SECRET');
  return { accessSecret, accessTokenTtl: configService.get<string>('JWT_ACCESS_TOKEN_TTL', '1h') };
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
