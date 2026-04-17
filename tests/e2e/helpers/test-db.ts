import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;

export function getTestPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set to run tests');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query(sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
  const p = getTestPool();
  const result = await p.query(sql, params);
  return { rows: result.rows as Record<string, unknown>[] };
}

export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function addDays(baseDate: Date, days: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
