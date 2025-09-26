import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for database connection");
}

// Determine SSL configuration for Neon database
function getSSLConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  
  // If DATABASE_URL contains sslmode=disable, don't use SSL
  if (databaseUrl?.includes('sslmode=disable')) {
    return false;
  }
  
  // For Neon database, always use SSL with rejectUnauthorized: false
  if (databaseUrl?.includes('neon.tech')) {
    return { rejectUnauthorized: false };
  }
  
  // For other cloud databases in production
  if (databaseUrl?.includes('render.com') || process.env.NODE_ENV === 'production') {
    return { rejectUnauthorized: false };
  }
  
  // For local development (including Replit), disable SSL by default
  return false;
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: getSSLConfig()
});

export const db = drizzle(pool, { schema });