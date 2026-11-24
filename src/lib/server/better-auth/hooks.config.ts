import { createAuthMiddleware } from 'better-auth/api';
import type { BetterAuthOptions } from 'better-auth/types';

export const hooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path === '/error') {
      const error = ctx.query?.error;
      const query = new URLSearchParams(ctx.query);
      if (error === 'BANNED_USER') {
        throw ctx.redirect(`/error?${query.toString()}`);
      }
    }
  })
} satisfies BetterAuthOptions['hooks'];
