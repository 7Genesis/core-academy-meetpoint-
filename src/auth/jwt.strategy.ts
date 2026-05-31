import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
  tenantId?: string;
  platformRole?: 'OWNER' | 'SUPPORT' | 'OPERATIONS' | 'MAINTENANCE';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromHttpOnlyCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}

function jwtFromHttpOnlyCookie(request: Request) {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) return null;

  const tokenCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='));

  if (!tokenCookie) return null;

  return decodeURIComponent(tokenCookie.slice('access_token='.length));
}
