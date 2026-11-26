const MINUTE_SEC = 60;
const HOUR_SEC = 60 * MINUTE_SEC;
const DAY_SEC = 24 * HOUR_SEC;

/** Longest a session can live: "Keep me logged in until I log out" ends after this long unused. */
export const UNTIL_LOGOUT_IDLE_SEC = 90 * DAY_SEC;
/** "Log out after an hour without use". */
export const IDLE_LOGIN_SEC = HOUR_SEC;
export const LOGIN_DAY_SEC = DAY_SEC;
/**
 * Better Auth's own session length and cookie lifetime. It matches the longest login option; each
 * session's real expiry is written per login option after sign-in.
 */
export const SESSION_EXPIRES_IN_SEC = UNTIL_LOGOUT_IDLE_SEC;
/** Activity (`lastActiveAt` and sliding expiry) is written at most this often per session. */
export const SESSION_ACTIVITY_WRITE_SEC = MINUTE_SEC;

export const USERNAME_CHARSET_PATTERN = /^[a-zA-Z0-9._]+$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PRESIGNED_URL_EXPIRES_IN_SEC = 15 * 60;
export const AVATAR_URL_EXPIRES_IN_SEC = HOUR_SEC;
