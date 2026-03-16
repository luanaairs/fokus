import { getSQL } from '@/lib/neon';
import { NextResponse } from 'next/server';

export async function POST() {
  const sql = getSQL();
  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  await sql`
    CREATE TABLE IF NOT EXISTS fokus_sync (
      table_name TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at BIGINT NOT NULL DEFAULT 0
    )
  `;

  return NextResponse.json({ ok: true, message: 'Database schema created' });
}
