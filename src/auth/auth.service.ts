import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DemoLoginDto } from './dto/demo-login.dto';

type DemoProfile = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
  tenantId?: string;
  platformRole?: 'OWNER' | 'SUPPORT' | 'OPERATIONS' | 'MAINTENANCE';
};

const demoProfiles: Record<string, DemoProfile> = {
  'admin@meetpoint.com': {
    sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    email: 'admin@meetpoint.com',
    role: 'ADMIN',
    platformRole: 'OWNER',
  },
  'suporte@meetpoint.com': {
    sub: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    email: 'julia@meetpoint.com',
    role: 'ADMIN',
    platformRole: 'SUPPORT',
  },
  'julia@meetpoint.com': {
    sub: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    email: 'julia@meetpoint.com',
    role: 'ADMIN',
    platformRole: 'SUPPORT',
  },
  'professor@coreacademy.com': {
    sub: '00000000-0000-0000-0000-000000000002',
    email: 'professor@coreacademy.com',
    role: 'ADMIN',
    tenantId: '00000000-0000-0000-0000-000000000010',
  },
  'autonomo@coreacademy.com': {
    sub: '00000000-0000-0000-0000-000000000004',
    email: 'autonomo@coreacademy.com',
    role: 'ADMIN',
    tenantId: '00000000-0000-0000-0000-000000000010',
  },
  'empresa@coreacademy.com': {
    sub: '00000000-0000-0000-0000-000000000005',
    email: 'empresa@coreacademy.com',
    role: 'ADMIN',
    tenantId: '00000000-0000-0000-0000-000000000010',
  },
  'aluno@meetpoint.com': {
    sub: '00000000-0000-0000-0000-000000000003',
    email: 'aluno@meetpoint.com',
    role: 'STUDENT',
    tenantId: '00000000-0000-0000-0000-000000000010',
  },
  'pf@meetpoint.com': {
    sub: '00000000-0000-0000-0000-000000000003',
    email: 'pf@meetpoint.com',
    role: 'STUDENT',
    tenantId: '00000000-0000-0000-0000-000000000010',
  },
  'pj@coreacademy.com': {
    sub: '00000000-0000-0000-0000-000000000005',
    email: 'pj@coreacademy.com',
    role: 'ADMIN',
    tenantId: '00000000-0000-0000-0000-000000000010',
  },
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  demoLogin(dto: DemoLoginDto) {
    const production = process.env.NODE_ENV === 'production';
    const demoLoginEnabled =
      this.configService.get<string>('ENABLE_DEMO_LOGIN') === 'true' || !production;
    const expectedPassword =
      this.configService.get<string>('DEMO_LOGIN_PASSWORD') ??
      (production ? undefined : '123456');

    if (!demoLoginEnabled || !expectedPassword || dto.password !== expectedPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const profile = demoProfiles[dto.email.toLowerCase()];
    if (!profile) throw new UnauthorizedException('Invalid credentials');

    return {
      accessToken: this.jwtService.sign(profile),
      user: profile,
    };
  }
}
