import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RefreshToken, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { ROLE_CODES } from '../rbac/rbac.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, PublicUser } from './types';

const BCRYPT_SALT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 30;

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: normalizeOptionalText(dto.displayName),
          },
        });
        const audienceRole = await tx.role.findUnique({
          where: { code: ROLE_CODES.audience },
        });

        if (!audienceRole) {
          throw new MissingDefaultAudienceRoleError();
        }

        await tx.userRole.create({
          data: {
            userId: createdUser.id,
            roleId: audienceRole.id,
          },
        });

        return createdUser;
      });

      return toPublicUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error, 'email')) {
        throw new ConflictException('Email is already registered');
      }

      if (error instanceof MissingDefaultAudienceRoleError) {
        throw new InternalServerErrorException('Default AUDIENCE role is not seeded');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const refreshToken = generateRefreshToken();
    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: refreshTokenExpiresAt(),
      },
    });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const matchedToken = await this.findMatchingRefreshToken(refreshToken);

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token is invalid, revoked, or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: matchedToken.userId } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Refresh token is invalid, revoked, or expired');
    }

    const nextRefreshToken = generateRefreshToken();
    const nextTokenHash = await bcrypt.hash(nextRefreshToken, BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: matchedToken.id },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: nextTokenHash,
          expiresAt: refreshTokenExpiresAt(),
        },
      });
    });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const matchedToken = await this.findMatchingRefreshToken(refreshToken, userId);

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token is invalid, revoked, or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });
  }

  private async findMatchingRefreshToken(
    refreshToken: string,
    userId?: string,
  ): Promise<RefreshToken | null> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(refreshToken, candidate.tokenHash)) {
        return candidate;
      }
    }

    return null;
  }

  private signAccessToken(user: Pick<User, 'id' | 'email'>): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return this.jwtService.signAsync(payload);
  }
}

class MissingDefaultAudienceRoleError extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

function refreshTokenExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes(field)
  );
}