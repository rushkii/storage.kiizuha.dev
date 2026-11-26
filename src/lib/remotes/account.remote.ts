import { invalid } from '@sveltejs/kit';
import { form, getRequestEvent, query } from '$app/server';
import { requireUser } from '#server/guard.ts';
import * as account from '#server/account.ts';
import {
  changePasswordSchema,
  profileSchema,
  signOutSessionsSchema
} from '#lib/schemas/account.ts';

const PASSWORD_MESSAGES = {
  invalid: 'Incorrect password. Nothing was changed.',
  rateLimited: 'Too many attempts. Wait a minute, then try again.'
} as const;

/** The signed-in user's profile, read fresh from the database, with a short-lived avatar URL. */
export const getProfile = query(async () => {
  const user = requireUser();
  return account.getProfile(user.id);
});

/** Active sessions of the signed-in user, the current one first. */
export const getSessions = query(async () => {
  const user = requireUser();
  const { locals } = getRequestEvent();
  return account.listSessions(user.id, locals.session?.id ?? '');
});

/**
 * Form: saves username, email, Gravatar choice and avatar after checking the password in the
 * same request. A wrong password changes nothing and comes back as an issue on `_password`.
 */
export const updateProfile = form(profileSchema, async (input, issue) => {
  const user = requireUser();

  const check = await account.checkPassword(user.id, input._password);
  if (check !== 'ok') invalid(issue._password(PASSWORD_MESSAGES[check]));

  const conflict = await account.updateProfile(user.id, input);
  if (conflict === 'username') invalid(issue.username('This username is taken.'));
  if (conflict === 'email') invalid(issue.email('This email is used by another account.'));
  if (conflict === 'avatar')
    invalid(issue.avatar('Use a PNG, JPG, WebP or AVIF image up to 2 MB.'));

  void getProfile().refresh();
  return { saved: true };
});

/**
 * Form: changes the password and signs out every other session. The "Current password" field is
 * the password confirmation, so there is no separate prompt.
 */
export const changePassword = form(changePasswordSchema, async (input, issue) => {
  const user = requireUser();
  const { locals } = getRequestEvent();
  const current = locals.session;
  if (!current) invalid('Sign in again to continue.');

  const failure = await account.changePassword(
    user.id,
    current,
    input._currentPassword,
    input._newPassword
  );
  if (failure === 'invalid') invalid(issue._currentPassword('Incorrect password.'));
  if (failure === 'rateLimited') invalid(issue._currentPassword(PASSWORD_MESSAGES.rateLimited));
  if (failure === 'rejected') invalid(issue._newPassword('This password can’t be used.'));

  return { changed: true };
});

/**
 * Form: signs out one session (`target` = its id) or every other session (`target` = `others`)
 * after checking the password. The current session is never signed out here.
 */
export const signOutSessions = form(signOutSessionsSchema, async ({ target, _password }, issue) => {
  const user = requireUser();
  const { locals } = getRequestEvent();

  const check = await account.checkPassword(user.id, _password);
  if (check !== 'ok') invalid(issue._password(PASSWORD_MESSAGES[check]));

  const count = await account.revokeSessions(user.id, locals.session?.id ?? '', target);
  void getSessions().refresh();
  return { count, target };
});
