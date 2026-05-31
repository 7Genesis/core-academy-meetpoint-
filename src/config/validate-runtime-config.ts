const weakSecretFragments = ['change-me', 'change_me', 'password', 'secret'];

function isWeakSecret(value: string | undefined) {
  if (!value || value.length < 32) return true;
  const normalized = value.toLowerCase();
  return weakSecretFragments.some((fragment) => normalized.includes(fragment));
}

export function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const requiredSecrets = [
    'JWT_SECRET',
    'WEBHOOK_SECRET',
    'STRIPE_WEBHOOK_SECRET',
  ];
  const weakSecrets = requiredSecrets.filter((key) =>
    isWeakSecret(process.env[key]),
  );

  if (weakSecrets.length > 0) {
    throw new Error(
      `Production startup blocked: configure strong values for ${weakSecrets.join(', ')}`,
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('Production startup blocked: DATABASE_URL is required');
  }

  if (!process.env.CORS_ORIGIN) {
    throw new Error('Production startup blocked: CORS_ORIGIN is required');
  }

  if (process.env.CORS_ORIGIN.split(',').some((origin) => origin.trim() === '*')) {
    throw new Error('Production startup blocked: wildcard CORS_ORIGIN is not allowed');
  }

  if (process.env.ENABLE_SWAGGER === 'true') {
    throw new Error('Production startup blocked: ENABLE_SWAGGER must be disabled');
  }

  if (process.env.ENABLE_DEMO_LOGIN === 'true') {
    const password = process.env.DEMO_LOGIN_PASSWORD;
    if (!password || password.length < 12) {
      throw new Error(
        'Production startup blocked: DEMO_LOGIN_PASSWORD must be at least 12 characters when demo login is enabled',
      );
    }
  }
}
