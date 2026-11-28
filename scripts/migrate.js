// Applies pending migrations from `drizzle/` and exits. Runs inside the production image, which
// ships only production dependencies, so it uses drizzle-orm's migrator instead of drizzle-kit.
// Both record applied migrations in the same `drizzle.__drizzle_migrations` table.

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(client), {
    migrationsFolder: new URL('../drizzle', import.meta.url).pathname
  });
  console.log('Migrations applied.');
} finally {
  await client.end();
}
