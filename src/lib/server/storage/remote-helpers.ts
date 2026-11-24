import { error } from '@sveltejs/kit';
import { UserFacingError } from './errors.ts';

/**
 * Runs a service call from a remote function. A `UserFacingError` becomes an HTTP error whose
 * message the UI can show as-is; anything else stays a 500 with a generic message.
 */
export const userFacing = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof UserFacingError) error(cause.status, cause.message);
    throw cause;
  }
};
