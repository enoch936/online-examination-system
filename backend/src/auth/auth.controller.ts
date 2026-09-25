import { Body, Controller, Delete, Get, Headers, Ip, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { PrismaService } from '../prisma/prisma.service';
import { durationToMs } from '../common/utils/duration.util';

type TokenResponse = Awaited<ReturnType<AuthService['login']>>;

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ) {
    const result = await this.auth.register(dto, { userAgent, ipAddress });
    this.setAuthCookies(response, result);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ) {
    const result = await this.auth.login(dto, { userAgent, ipAddress });
    this.setAuthCookies(response, result);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ) {
    const refreshToken = dto.refreshToken ?? request.cookies?.refresh_token ?? '';
    const result = await this.auth.refresh(refreshToken, { userAgent, ipAddress });
    this.setAuthCookies(response, result);
    return result;
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.logout(request.cookies?.refresh_token);
    this.clearAuthCookies(response);
    return result;
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.auth.getProfile(currentUser.sub);
  }

  @ApiBearerAuth()
  @Patch('me')
  async updateProfile(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(currentUser.sub, dto);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  async changePassword(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(currentUser.sub, dto);
  }

  // --- Session Management ---

  @ApiBearerAuth()
  @Get('sessions')
  async listSessions(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.auth.getSessions(currentUser.sub);
  }

  @ApiBearerAuth()
  @Delete('sessions/:sessionId')
  async revokeSession(@CurrentUser() currentUser: AuthenticatedUser, @Param('sessionId') sessionId: string) {
    await this.auth.revokeSession(currentUser.sub, sessionId);
    return { revoked: true };
  }

  @ApiBearerAuth()
  @Delete('sessions')
  async revokeAllSessions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refresh_token;
    let excludeSessionId: string | undefined;

    if (refreshToken) {
      try {
        const decoded = this.jwt.decode(refreshToken) as { jti?: string } | null;
        if (decoded?.jti) {
          const token = await this.prisma.refreshToken.findUnique({ where: { jti: decoded.jti } });
          if (token && token.userId === currentUser.sub) {
            excludeSessionId = token.id;
          }
        }
      } catch {}
    }

    await this.auth.revokeAllSessions(currentUser.sub, excludeSessionId);
    this.clearAuthCookies(response);
    return { revoked: true };
  }

  @ApiBearerAuth()
  @Post('cleanup-sessions')
  async cleanupSessions(@CurrentUser() currentUser: AuthenticatedUser) {
    const count = await this.auth.cleanupExpiredTokens();
    return { cleaned: count };
  }

  private setAuthCookies(response: Response, result: TokenResponse) {
    const domain = this.config.get<string | undefined>('COOKIE_DOMAIN');
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE', 'lax');
    const secure = this.config.get<boolean>('COOKIE_SECURE', false) || sameSite === 'none';
    const path = this.config.get<string>('COOKIE_PATH', '/');
    const common = {
      httpOnly: true,
      secure,
      sameSite,
      // Browsers reject a Domain attribute for localhost hosts.
      domain: domain === 'localhost' || domain === '' ? undefined : domain,
      path,
    };

    const accessMaxAge = durationToMs(this.config.get<string>('JWT_ACCESS_EXPIRES_IN'), 15 * 60 * 1000);
    const refreshMaxAge = durationToMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN'), 7 * 24 * 60 * 60 * 1000);

    response.cookie('access_token', result.accessToken, {
      ...common,
      maxAge: accessMaxAge,
    });
    response.cookie('refresh_token', result.refreshToken, {
      ...common,
      maxAge: refreshMaxAge,
    });
  }

  private clearAuthCookies(response: Response) {
    const domain = this.config.get<string | undefined>('COOKIE_DOMAIN');
    response.clearCookie('access_token', {
      domain: domain === 'localhost' || domain === '' ? undefined : domain,
      path: this.config.get<string>('COOKIE_PATH', '/'),
    });
    response.clearCookie('refresh_token', {
      domain: domain === 'localhost' || domain === '' ? undefined : domain,
      path: this.config.get<string>('COOKIE_PATH', '/'),
    });
  }
}
