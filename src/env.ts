import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  APP_NAME: {
    description: 'The app name shown in the page title and sidebar.',
    public: true,
    static: true
  },
  DATABASE_URL: { description: 'The database connection string.' },
  ORIGIN: {
    description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
  },
  BETTER_AUTH_SECRET: {
    description:
      'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
  },
  S3_ENDPOINT: {
    description:
      'Custom S3-compatible endpoint (Cloudflare R2, MinIO, Garage, ...). Leave empty to use AWS S3.',
    schema: (value) => value || undefined
  },
  S3_REGION: {
    description: 'Bucket region. Use `auto` for Cloudflare R2. Defaults to `us-east-1`.',
    schema: (value) => value || 'us-east-1'
  },
  S3_ACCESS_KEY_ID: { description: 'Access key ID used to sign S3 requests.' },
  S3_SECRET_ACCESS_KEY: { description: 'Secret access key used to sign S3 requests.' },
  S3_BUCKET: { description: 'Name of the bucket that stores user files.' },
});
