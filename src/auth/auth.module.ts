import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtKeyService } from './jwt-key.service';
import { TokenRevocationService } from './token-revocation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const privateKey = configService
          .get<string>('JWT_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n');
        const publicKey = configService
          .get<string>('JWT_PUBLIC_KEY')
          ?.replace(/\\n/g, '\n');
        const issuer = configService.get<string>('JWT_ISSUER') ?? 'core-academy-api';
        const audience =
          configService.get<string>('JWT_AUDIENCE') ?? 'core-academy-clients';
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
        if (!secret) {
          if (process.env.STRICT_RUNTIME_VALIDATION?.trim().toLowerCase() === 'true') {
            throw new Error('JWT_SECRET is required when STRICT_RUNTIME_VALIDATION=true');
          }
          console.warn(
            'Runtime configuration warning: JWT_SECRET is missing; JwtModule is using compatibility secret.',
          );
        }

        return {
          secret:
            secret ??
            'core-academy-shared-hosting-compatibility-jwt-secret-change-before-real-use',
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
  providers: [AuthService, JwtStrategy, JwtKeyService, TokenRevocationService],
  exports: [JwtKeyService, TokenRevocationService],
})
export class AuthModule {}
