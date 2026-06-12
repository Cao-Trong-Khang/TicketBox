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

export type JwtConfig = {
  accessSecret: string;
  accessTokenTtl: string;
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

export function getJwtConfig(configService: ConfigService): JwtConfig {
  const accessSecret = configService.get<string>('JWT_ACCESS_SECRET', 'local-development-jwt-secret');

  if (!accessSecret.trim()) {
    throw new Error('Invalid empty environment value for JWT_ACCESS_SECRET');
  }

  return {
    accessSecret,
    accessTokenTtl: configService.get<string>('JWT_ACCESS_TOKEN_TTL', '1h'),
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
