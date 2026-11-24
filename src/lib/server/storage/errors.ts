/** An error whose message is written for the person using the app and safe to show them. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** True for a Postgres unique violation, whether or not Drizzle wrapped the driver error. */
export const isUniqueViolation = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current === 'object' && 'code' in current && current.code === '23505') return true;
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return false;
};

/** True for a Postgres foreign key violation (e.g. deleting a category that still has folders). */
export const isForeignKeyViolation = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current === 'object' && 'code' in current && current.code === '23503') return true;
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return false;
};
