const weakSecretFragments = ['change-me', 'change_me', 'password', 'secret'];
const requiredStartupValues = [
  'DATABASE_URL',
  'JWT_SECRET',
];
const strictProductionValues = [
  ...requiredStartupValues,
  'JWT_KID',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'PII_ENCRYPTION_KEY',
  'WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SECRET',
] as const;

function isWeakSecret(value: string | undefined) {
  if (!value || value.length < 32) return true;
  const normalized = value.toLowerCase();
  return weakSecretFragments.some((fragment) => normalized.includes(fragment));
}

export function validateRuntimeConfig() {
  normalizeRuntimeEnv();
  logRuntimeEnvDiagnostics();

  const strictValidation = isStrictRuntimeValidationEnabled();
  const shouldBlockStartup =
    process.env.NODE_ENV === 'production' && strictValidation;
  const report = shouldBlockStartup ? blockRuntimeStartup : warnRuntimeConfig;

  const missingValues = strictProductionValues.filter((key) => !getEnv(key));
  if (missingValues.length > 0) {
    report(
      `configure ${missingValues.join(', ')}`,
    );
  }

  const weakSecrets = [
    'JWT_SECRET',
    'JWT_PRIVATE_KEY',
    'PII_ENCRYPTION_KEY',
    'WEBHOOK_SECRET',
    'STRIPE_WEBHOOK_SECRET',
  ].filter((key) => process.env[key] && isWeakSecret(process.env[key]));

  if (weakSecrets.length > 0) {
    report(
      `configure strong values for ${weakSecrets.join(', ')}`,
    );
  }

  const hasAsymmetricJwt =
    Boolean(process.env.JWT_PRIVATE_KEY) && Boolean(process.env.JWT_PUBLIC_KEY);
  const hasSymmetricJwt = Boolean(process.env.JWT_SECRET);
  if (!hasAsymmetricJwt && !hasSymmetricJwt) {
    report(
      'configure JWT_PRIVATE_KEY/JWT_PUBLIC_KEY or JWT_SECRET',
    );
  }

  if (
    process.env.JWT_ALGORITHM &&
    !['RS256', 'HS256'].includes(process.env.JWT_ALGORITHM)
  ) {
    report('JWT_ALGORITHM must be RS256 or HS256');
  }

  if (process.env.JWT_ALGORITHM === 'RS256' && !hasAsymmetricJwt) {
    report(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required for RS256',
    );
  }

  if (process.env.JWT_ALGORITHM === 'HS256' && isWeakSecret(process.env.JWT_SECRET)) {
    report('configure a strong JWT_SECRET');
  }

  if (process.env.PII_ENCRYPTION_KEY && !isValidPiiEncryptionKey(process.env.PII_ENCRYPTION_KEY)) {
    report('PII_ENCRYPTION_KEY must be 32 UTF-8 bytes, 32-byte base64, or 64 hex characters');
  }

  if (!process.env.CORS_ORIGIN) {
    report('CORS_ORIGIN is required');
  }

  if (process.env.CORS_ORIGIN?.split(',').some((origin) => origin.trim() === '*')) {
    report('wildcard CORS_ORIGIN is not allowed');
  }

  if (process.env.COOKIE_SECURE?.trim().toLowerCase() === 'false') {
    report('COOKIE_SECURE cannot be false');
  }

  if (process.env.ENABLE_SWAGGER === 'true') {
    report('ENABLE_SWAGGER must be disabled');
  }

}

function normalizeRuntimeEnv() {
  const envNames = [
    ...strictProductionValues,
    'NODE_ENV',
    'STRICT_RUNTIME_VALIDATION',
    'JWT_ALGORITHM',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'COOKIE_SECURE',
    'ENABLE_SWAGGER',
    'CORS_ORIGIN',
    'TESTE',
  ];

  for (const name of envNames) {
    const value = process.env[name];
    if (value !== undefined) process.env[name] = value.trim();
  }
}

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function logRuntimeEnvDiagnostics() {
  console.log('ENV CHECK NODE_ENV=', process.env.NODE_ENV);
  console.log(
    'ENV CHECK STRICT_RUNTIME_VALIDATION=',
    process.env.STRICT_RUNTIME_VALIDATION,
  );
  console.log('ENV CHECK HAS_DATABASE_URL=', !!process.env.DATABASE_URL);
  console.log('ENV CHECK HAS_JWT_SECRET=', !!process.env.JWT_SECRET);
  console.log('ENV CHECK HAS_JWT_KID=', !!process.env.JWT_KID);
  console.log('ENV CHECK HAS_JWT_ISSUER=', !!process.env.JWT_ISSUER);
  console.log('ENV CHECK HAS_JWT_AUDIENCE=', !!process.env.JWT_AUDIENCE);
  console.log('ENV CHECK HAS_PII_ENCRYPTION_KEY=', !!process.env.PII_ENCRYPTION_KEY);
  console.log(
    'ENV CHECK PII_ENCRYPTION_KEY_LENGTH=',
    process.env.PII_ENCRYPTION_KEY?.length,
  );
  console.log('ENV CHECK HAS_WEBHOOK_SECRET=', !!process.env.WEBHOOK_SECRET);
  console.log(
    'ENV CHECK HAS_STRIPE_WEBHOOK_SECRET=',
    !!process.env.STRIPE_WEBHOOK_SECRET,
  );
}

function isStrictRuntimeValidationEnabled() {
  return process.env.STRICT_RUNTIME_VALIDATION?.trim().toLowerCase() === 'true';
}

function warnRuntimeConfig(message: string) {
  console.warn(`Runtime configuration warning: ${message}`);
}

function blockRuntimeStartup(message: string): never {
  throw new Error(`Production startup blocked: ${message}`);
}

function isValidPiiEncryptionKey(value: string | undefined) {
  if (!value) return false;
  if (/^[0-9a-f]{64}$/i.test(value)) return true;
  if (Buffer.from(value, 'utf8').length === 32) return true;

  try {
    return Buffer.from(value, 'base64').length === 32;
  } catch {
    return false;
  }
}
