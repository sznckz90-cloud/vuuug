import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. For Neon: get your connection string from Neon dashboard. For Replit: ensure database is provisioned.");
}

// Determine SSL configuration for Drizzle
function getSSLConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  
  // If DATABASE_URL contains sslmode=disable, don't use SSL
  if (databaseUrl?.includes('sslmode=disable')) {
    return false;
  }
  
  // For Neon and other cloud databases, enable SSL
  if (databaseUrl?.includes('neon.tech') || 
      databaseUrl?.includes('render.com') || 
      process.env.NODE_ENV === 'production') {
    // Use secure SSL by default, allow insecure only if explicitly set
    return process.env.DB_SSL_INSECURE === 'true' 
      ? { rejectUnauthorized: false }
      : true;
  }
  
  // For local development, disable SSL by default
  return false;
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: getSSLConfig()
  },
});
