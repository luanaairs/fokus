import { neon } from '@neondatabase/serverless';

export function getSQL() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}
