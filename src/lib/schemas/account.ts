import * as v from 'valibot';

// Login options and account settings forms. Shared by remote functions (server validation)
// and forms (client `preflight`).

export const LOGIN_MODES = ['idle_1h', 'fixed_days', 'until_logout'] as const;
export type LoginMode = (typeof LOGIN_MODES)[number];
export const DEFAULT_LOGIN_MODE: LoginMode = 'idle_1h';
export const LOGIN_DAYS_MIN = 1;
export const LOGIN_DAYS_MAX = 90;
export const LOGIN_DAYS_DEFAULT = 7;

export const loginModeSchema = v.picklist(LOGIN_MODES);

/** Integer 1–90; only sent while "Keep me logged in for [n] days" is selected. */
export const loginDaysSchema = v.pipe(
  v.number('Enter a number of days.'),
  v.integer('Use a whole number of days.'),
  v.minValue(LOGIN_DAYS_MIN, `Use ${LOGIN_DAYS_MIN} to ${LOGIN_DAYS_MAX} days.`),
  v.maxValue(LOGIN_DAYS_MAX, `Use ${LOGIN_DAYS_MIN} to ${LOGIN_DAYS_MAX} days.`)
);

export const AVATAR_SOURCE_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_SOURCE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const;
export const AVATAR_SIZE_PX = 512;

const passwordSchema = v.pipe(v.string(), v.minLength(1, 'Enter your password.'));

export const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export const profileSchema = v.object({
  username: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.minLength(3, 'Use at least 3 characters.'),
    v.maxLength(30, 'Use 30 characters or fewer.'),
    v.regex(USERNAME_PATTERN, 'Use letters, numbers, dots and underscores only.')
  ),
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Enter a valid email.')),
  useGravatar: v.optional(v.boolean(), false),
  removeAvatar: v.optional(v.boolean(), false),
  /** The cropped avatar. An empty file input means "unchanged". */
  avatar: v.optional(v.file()),
  _password: passwordSchema
});

const NEW_PASSWORD_MIN = 8;
const NEW_PASSWORD_MAX = 128;

export const changePasswordSchema = v.pipe(
  v.object({
    _currentPassword: v.pipe(v.string(), v.minLength(1, 'Enter your current password.')),
    _newPassword: v.pipe(
      v.string(),
      v.minLength(NEW_PASSWORD_MIN, `Use at least ${NEW_PASSWORD_MIN} characters.`),
      v.maxLength(NEW_PASSWORD_MAX, `Use ${NEW_PASSWORD_MAX} characters or fewer.`)
    ),
    _confirmPassword: v.string()
  }),
  v.forward(
    v.partialCheck(
      [['_newPassword'], ['_confirmPassword']],
      (input) => input._newPassword === input._confirmPassword,
      'Passwords don’t match.'
    ),
    ['_confirmPassword']
  ),
  v.forward(
    v.partialCheck(
      [['_currentPassword'], ['_newPassword']],
      (input) => input._currentPassword !== input._newPassword,
      'Use a password different from the current one.'
    ),
    ['_newPassword']
  )
);

/** `target` is a session id, or `others` for every session except the current one. */
export const signOutSessionsSchema = v.object({
  target: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  _password: passwordSchema
});

export const NEW_PASSWORD_MIN_LENGTH = NEW_PASSWORD_MIN;
