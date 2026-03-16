import { auth } from '@/auth';
import { getSQL } from '@/lib/neon';
import { NextResponse } from 'next/server';

const TABLES = [
  'students', 'studentGroups', 'notes', 'tasks', 'projects',
  'lessonPlans', 'writingProjects', 'captures', 'focusSessions',
  'parkingLot', 'dailyStreaks',
] as const;

// Auto-create table if it doesn't exist
async function ensureSchema(sql: ReturnType<typeof getSQL>) {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS fokus_sync (
        table_name TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at BIGINT NOT NULL DEFAULT 0
      )
    `;
  } catch {
    // Table may already exist, ignore
  }
}

// GET: Pull all data from cloud
export const GET = auth(async function GET(req) {
  if (process.env.AUTH_PASSWORD && !req.auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSQL();
  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  await ensureSchema(sql);

  const rows = await sql`SELECT table_name, data, updated_at FROM fokus_sync`;
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.table_name as string] = row.data;
  }

  return NextResponse.json(result);
});

// POST: Push all data to cloud
export const POST = auth(async function POST(req) {
  if (process.env.AUTH_PASSWORD && !req.auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSQL();
  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  await ensureSchema(sql);

  const body = await req.json();
  const now = Date.now();

  for (const table of TABLES) {
    const data = body[table];
    if (data !== undefined) {
      await sql`
        INSERT INTO fokus_sync (table_name, data, updated_at)
        VALUES (${table}, ${JSON.stringify(data)}::jsonb, ${now})
        ON CONFLICT (table_name) DO UPDATE SET
          data = ${JSON.stringify(data)}::jsonb,
          updated_at = ${now}
      `;
    }
  }

  return NextResponse.json({ ok: true, syncedAt: now });
});
