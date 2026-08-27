import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Neon pooled connections get dropped while idle. Without a listener, the
// resulting 'error' event on the Pool is an unhandled 'error' event, which
// terminates the process and aborts every in-flight request with a bare
// "Internal Server Error". Log it instead so it is diagnosable.
pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle database client:', err?.message || err);
  if (err?.stack) {
    console.error(`[db] stack:\n${err.stack}`);
  }
});

export const db = drizzle({ client: pool, schema, casing: 'camelCase' });
