import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { DemoLoginDto } from './dto/demo-login.dto';
import { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('demo-login')
  demoLogin(@Body() dto: DemoLoginDto, @Res({ passthrough: true }) response: Response) {
    const login = this.authService.demoLogin(dto);
    response.cookie('access_token', login.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return login;
  }

  @Post('logout')
  async logout(
    @Req() request: Request & { user?: JwtPayload },
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie('access_token', { path: '/' });
    return this.authService.logout(request.user);
  }

  @Public()
  @Get('jwks.json')
  jwks() {
    return this.authService.jwks();
  }
}
