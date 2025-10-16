import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set - database operations may fail");
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
  
  // For local development, disable SSL by default
  return false;
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: getSSLConfig()
  },
});
