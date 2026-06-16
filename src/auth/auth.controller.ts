import { Body, Controller, Get, Patch, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrivacyConsentDto } from './dto/privacy-consent.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';
import { EmailVerificationService } from './email-verification.service';
import { JwtPayload } from './jwt.strategy';

const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000;
type AuthSameSite = CookieOptions['sameSite'];

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email-verification-code')
  requestEmailVerificationCode(@Body() dto: RequestEmailVerificationDto) {
    return this.emailVerificationService.requestRegistrationCode(dto.email, dto.name);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, {
      ip: getClientIp(request),
      userAgent: request.get('user-agent') ?? '',
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const login = await this.authService.login(dto, {
      ip: getClientIp(request),
      userAgent: request.get('user-agent') ?? '',
    });
    response.cookie(ACCESS_TOKEN_COOKIE, login.accessToken, {
      ...getAuthCookieOptions(),
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    return login;
  }

  @Get('me')
  me(@Req() request: Request & { user?: JwtPayload }) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    return this.authService.getAuthenticatedUser(request.user);
  }

  @Patch('profile')
  updateProfile(
    @Body() dto: UpdatePublicProfileDto,
    @Req() request: Request & { user?: JwtPayload },
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    return this.authService.updatePublicProfile(request.user, dto);
  }

  @Get('people')
  people(
    @Req() request: Request & { user?: JwtPayload },
    @Query('search') search = '',
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    return this.authService.searchPeople(request.user, search);
  }

  @Post('logout')
  async logout(
    @Req() request: Request & { user?: JwtPayload },
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, getAuthCookieOptions());
    return this.authService.logout(request.user);
  }

  @Post('privacy-consent')
  async acceptPrivacyConsent(
    @Body() dto: PrivacyConsentDto,
    @Req() request: Request & { user?: JwtPayload },
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    return this.authService.acceptPrivacyConsent(request.user.sub, dto, {
      ip: getClientIp(request),
      userAgent: request.get('user-agent') ?? '',
    });
  }

  @Public()
  @Get('jwks.json')
  jwks() {
    return this.authService.jwks();
  }
}

function getClientIp(request: Request) {
  const forwardedFor = request.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.ip || '';
}

function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: resolveCookieSameSite(),
    path: '/',
  };
}

function shouldUseSecureCookie() {
  if (process.env.NODE_ENV === 'production') return true;

  const configured = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;

  return false;
}

function resolveCookieSameSite(): AuthSameSite {
  const configured = process.env.COOKIE_SAMESITE?.trim().toLowerCase();
  if (configured === 'strict') return 'strict';
  if (configured === 'lax') return 'lax';
  if (configured === 'none') return 'none';

  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}
