import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '#lib/server/db/index.ts';
import { hooks, plugins, AUTH_DISABLED_PATHS } from './better-auth/index.ts';
import { SESSION_EXPIRES_IN_SEC } from './constants.ts';

export const auth = betterAuth({
  baseURL: ORIGIN,
  trustedOrigins: [ORIGIN],
  secret: BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    // Single admin account: no public sign-up. Create the account with the admin plugin's
    // `auth.api.createUser` from a server-side script. Called without headers it runs as a
    // trusted call, so never expose it through a route or remote function.
    disableSignUp: true,
    requireEmailVerification: false
  },
  user: {
    additionalFields: {
      // Show the Gravatar image when the user has no uploaded avatar.
      useGravatar: { type: 'boolean', required: false, defaultValue: false, input: false }
    }
  },
  session: {
    expiresIn: SESSION_EXPIRES_IN_SEC,
    // Expiry is managed per login option (`#server/session-activity.ts`), never by Better Auth.
    disableSessionRefresh: true,
    additionalFields: {
      loginMode: { type: 'string', required: false, input: false },
      loginDays: { type: 'number', required: false, input: false },
      lastActiveAt: { type: 'date', required: false, input: false }
    }
  },
  disabledPaths: [...AUTH_DISABLED_PATHS],
  advanced: {
    cookiePrefix: 'kz',
    // Caddy sets `x-real-ip` to the client IP and overwrites any client value. Only safe while
    // the app is reachable through Caddy alone; otherwise a client can forge the header.
    ipAddress: { ipAddressHeaders: ['x-real-ip'] }
  },
  plugins,
  hooks
});
