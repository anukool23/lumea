import { Pool } from "pg";
import type { PoolClient } from "pg";
import { logger } from "./logger";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.POSTGRES_DSN,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    _pool.on("error", (err) => {
      logger.error({ err }, "PostgreSQL pool error");
    });
  }
  return _pool;
}

export async function logEmail(
  to: string,
  subject: string,
  type: string,
  status: string
): Promise<void> {
  try {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query(
        `INSERT INTO comms.email_log (recipient, subject, type, status, sent_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [to, subject, type, status]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err, to, type }, "email_log insert failed — continuing");
  }
}
