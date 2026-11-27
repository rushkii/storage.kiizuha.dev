import type { auth } from '#lib/server/auth.ts';

type AuthSession = typeof auth.$Infer.Session;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      user?: AuthSession['user'];
      session?: AuthSession['session'];
    }

    interface Error {
      /** Set by `handleError` for unexpected errors, so a user can quote it. */
      errorId?: string;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
