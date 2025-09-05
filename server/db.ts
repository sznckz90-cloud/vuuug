import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL not set - using temporary in-memory fallback");
  // Set a temporary SQLite URL for development - this will be replaced when database is provisioned
  process.env.DATABASE_URL = "postgresql://temp:temp@localhost:5432/temp";
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });