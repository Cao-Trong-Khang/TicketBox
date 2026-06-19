import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { ROLE_CODES } from '../rbac/rbac.constants';
import { PermissionService } from '../rbac/permission.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokens, JwtPayload, PublicUser } from './types';

const BCRYPT_SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly permissionService: PermissionService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const audienceRole = await tx.role.findUnique({
          where: { code: ROLE_CODES.audience },
        });

        if (!audienceRole) {
          throw new MissingDefaultAudienceRoleError();
        }

        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: normalizeOptionalText(dto.fullName),
            phone: normalizeOptionalText(dto.phone),
            userRoles: {
              create: {
                roleId: audienceRole.id,
              },
            },
          },
        });

        return createdUser;
      });

      return this.toPublicUser(user, [ROLE_CODES.audience]);
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

    return this.issueTokenPair(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const parsed = parseRefreshToken(dto.refresh_token);

    if (!parsed) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const existing = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt <= new Date() ||
      existing.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(parsed.secret, existing.tokenHash);

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const roles = await this.permissionService.getUserRoles(existing.userId);
    const nextRefresh = await createRefreshTokenValue();

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          id: nextRefresh.id,
          userId: existing.userId,
          tokenHash: nextRefresh.hash,
          expiresAt: getRefreshTokenExpiry(),
        },
      });
    });

    return {
      access_token: await this.signAccessToken(existing.userId, roles),
      refresh_token: nextRefresh.value,
      user: this.toPublicUser(existing.user, roles),
    };
  }

  async logout(userId: string, dto: RefreshTokenDto): Promise<void> {
    const parsed = parseRefreshToken(dto.refresh_token);

    if (!parsed) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const existing = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
    });

    if (!existing || existing.userId !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(parsed.secret, existing.tokenHash);

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid authenticated user');
    }

    const roles = await this.permissionService.getUserRoles(user.id);
    return this.toPublicUser(user, roles);
  }

  private async issueTokenPair(user: User): Promise<AuthTokens> {
    const roles = await this.permissionService.getUserRoles(user.id);
    const refreshToken = await createRefreshTokenValue();

    await this.prisma.refreshToken.create({
      data: {
        id: refreshToken.id,
        userId: user.id,
        tokenHash: refreshToken.hash,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return {
      access_token: await this.signAccessToken(user.id, roles),
      refresh_token: refreshToken.value,
      user: this.toPublicUser(user, roles),
    };
  }

  private signAccessToken(userId: string, roles: string[]): Promise<string> {
    const payload: JwtPayload = {
      user_id: userId,
      roles,
    };

    return this.jwtService.signAsync(payload);
  }

  private toPublicUser(user: User, roles: string[]): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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

async function createRefreshTokenValue() {
  const id = cryptoRandomUuid();
  const secret = randomBytes(48).toString('base64url');

  return {
    id,
    value: `${id}.${secret}`,
    hash: await bcrypt.hash(secret, BCRYPT_SALT_ROUNDS),
  };
}

function parseRefreshToken(value: string): { id: string; secret: string } | null {
  const separatorIndex = value.indexOf('.');

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return null;
  }

  return {
    id: value.slice(0, separatorIndex),
    secret: value.slice(separatorIndex + 1),
  };
}

function getRefreshTokenExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

function cryptoRandomUuid(): string {
  return randomBytes(16).toString('hex').replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    '$1-$2-$3-$4-$5',
  );
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes(field)
  );
}
