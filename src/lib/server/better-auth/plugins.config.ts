import type { BetterAuthOptions } from 'better-auth/types';
import { admin, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { USERNAME_CHARSET_PATTERN } from '#server/constants.ts';

export const plugins = [
  admin(),
  username({
    displayUsername: false,
    usernameValidator: (username) => USERNAME_CHARSET_PATTERN.test(username),
    usernameNormalization: (username) => {
      return username.toLowerCase();
    },
    validationOrder: {
      username: 'post-normalization'
    }
  }),
  sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
] satisfies BetterAuthOptions['plugins'];
