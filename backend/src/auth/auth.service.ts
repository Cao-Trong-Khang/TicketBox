import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_CODES } from '../rbac/rbac.constants';
import { PrismaService } from '../shared/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, PublicUser } from './types';

const BCRYPT_SALT_ROUNDS = 12;

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

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
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

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes(field)
  );
}
