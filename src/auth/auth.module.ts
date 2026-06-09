import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtKeyService } from './jwt-key.service';
import { TokenRevocationService } from './token-revocation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    SubscriptionsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const privateKey = configService
          .get<string>('JWT_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n');
        const publicKey = configService
          .get<string>('JWT_PUBLIC_KEY')
          ?.replace(/\\n/g, '\n');
        const issuer = configService.get<string>('JWT_ISSUER') ?? 'meetpoint-api';
        const audience =
          configService.get<string>('JWT_AUDIENCE') ?? 'meetpoint-clients';
        const kid = configService.get<string>('JWT_KID') ?? 'local-dev-key';

        if (privateKey && publicKey) {
          return {
            privateKey,
            publicKey,
            signOptions: {
              algorithm: 'RS256' as const,
              issuer,
              audience,
              keyid: kid,
              expiresIn: '8h',
            },
          };
        }

        const secret = configService.get<string>('JWT_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET is required in production');
        }
        if (!secret) {
          console.warn('Runtime configuration warning: JWT_SECRET is missing.');
        }

        return {
          secret: secret ?? 'meetpoint-local-development-jwt-secret',
          signOptions: {
            algorithm: 'HS256' as const,
            issuer,
            audience,
            keyid: kid,
            expiresIn: '8h',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, JwtStrategy, JwtKeyService, TokenRevocationService],
  exports: [JwtKeyService, TokenRevocationService],
})
export class AuthModule {}
