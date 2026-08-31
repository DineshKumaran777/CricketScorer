const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'GOOGLE_CLIENT_ID'] as const;
const optionalEnvVars = ['PORT', 'NODE_ENV', 'CORS_ORIGIN'] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please set them in your .env file or environment.'
    );
  }

  for (const varName of optionalEnvVars) {
    if (!process.env[varName]) {
      console.warn(`Optional environment variable "${varName}" is not set. Using defaults.`);
    }
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production' && !process.env.CORS_ORIGIN) {
    console.warn('CORS_ORIGIN is not set in production. CORS may block requests.');
  }
}
