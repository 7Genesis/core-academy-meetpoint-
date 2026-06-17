import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateRuntimeConfig } from './config/validate-runtime-config';

async function bootstrap() {
  await loadRuntimeEnv();
  validateRuntimeConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '8mb';
  app.useBodyParser('json', { limit: jsonBodyLimit });
  app.useBodyParser('urlencoded', { limit: jsonBodyLimit, extended: true });
  const appBasePath = resolveAppBasePath();
  if (appBasePath) {
    app.use((request: Request, _response: Response, next: NextFunction) => {
      if (request.url === appBasePath) {
        request.url = '/';
      } else if (request.url.startsWith(`${appBasePath}/`)) {
        request.url = request.url.slice(appBasePath.length) || '/';
      }
      next();
    });
  }
  app.use(
    helmet({
      contentSecurityPolicy:
        isProduction
          ? {
              useDefaults: true,
              directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
                formAction: ["'self'"],
                objectSrc: ["'none'"],
                frameSrc: [
                  "'self'",
                  'https://www.youtube.com',
                  'https://www.youtube-nocookie.com',
                ],
                childSrc: [
                  "'self'",
                  'https://www.youtube.com',
                  'https://www.youtube-nocookie.com',
                ],
                imgSrc: [
                  "'self'",
                  'data:',
                  'https:',
                  'https://i.ytimg.com',
                  'https://img.youtube.com',
                ],
                mediaSrc: ["'self'", 'blob:', 'https:'],
                fontSrc: ["'self'", 'data:'],
                scriptSrc: ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                connectSrc: ["'self'", ...resolveCspConnectSources()],
                workerSrc: ["'self'", 'blob:'],
                manifestSrc: ["'self'"],
                upgradeInsecureRequests: [],
              },
            }
          : false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hsts:
        isProduction
          ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
          : false,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = request.header('X-Request-ID') || randomUUID();
    response.setHeader('X-Request-ID', requestId);
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()',
    );
    response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    response.setHeader('X-Download-Options', 'noopen');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Origin-Agent-Cluster', '?1');
    if (/^\/(auth|payments|webhooks|platform-admin|support)(\/|$)/.test(request.path)) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Pragma', 'no-cache');
    }
    next();
  });
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Tenant-ID',
      'Idempotency-Key',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MeetPoint API')
      .setDescription('White-label multi-tenant EAD API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-Tenant-ID',
          in: 'header',
        },
        'tenant-id',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();

async function loadRuntimeEnv() {
  const envPaths = [
    resolve(process.cwd(), '.env'),
    process.env.MEETPOINT_APP_ROOT || process.env.COREACADEMY_APP_ROOT
      ? resolve(process.env.MEETPOINT_APP_ROOT || process.env.COREACADEMY_APP_ROOT!, '.env')
      : '',
    '/home/nova3034/api-meetpoint/.env',
  ].filter(Boolean);

  for (const envPath of [...new Set(envPaths)]) {
    if (existsSync(envPath)) {
      const dotenv = await loadOptionalDotenv();
      if (!dotenv) {
        console.warn(`Runtime configuration warning: .env found at ${envPath}, but optional dotenv package is not installed.`);
        continue;
      }
      dotenv.config({ path: envPath, override: false });
    }
  }
}

async function loadOptionalDotenv() {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{ config: (options: { path: string; override: boolean }) => void }>;
    return await dynamicImport('dotenv');
  } catch {
    return null;
  }
}

function resolveCorsOrigins() {
  const configuredOrigins =
    process.env.CORS_ORIGIN?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (configuredOrigins.length) return configuredOrigins;
  if (process.env.NODE_ENV === 'production') return false;

  return [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5174',
  ];
}

function resolveCspConnectSources() {
  return (
    process.env.CSP_CONNECT_SRC?.split(',')
      .map((source) => source.trim())
      .filter(Boolean) ?? []
  );
}

function resolveAppBasePath() {
  const configured = process.env.APP_BASE_PATH?.trim();
  if (!configured || configured === '/') return '';
  return `/${configured.replace(/^\/+|\/+$/g, '')}`;
}
