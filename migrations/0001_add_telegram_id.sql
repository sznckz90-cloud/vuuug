
-- Add telegramId column to users table
ALTER TABLE "users" ADD COLUMN "telegram_id" text;

-- Make email column nullable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Add unique constraint on telegram_id
ALTER TABLE "users" ADD CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id");

-- Add telegramId column to withdrawal_requests table
ALTER TABLE "withdrawal_requests" ADD COLUMN "telegram_id" text;

-- Make email column nullable in withdrawal_requests
ALTER TABLE "withdrawal_requests" ALTER COLUMN "email" DROP NOT NULL;

-- Update existing users with mock telegram IDs (if any exist)
-- This is for development - in production you'd need proper migration strategy
UPDATE "users" SET "telegram_id" = 'mock_' || "id" WHERE "telegram_id" IS NULL;

-- Make telegram_id NOT NULL after setting values
ALTER TABLE "users" ALTER COLUMN "telegram_id" SET NOT NULL;
