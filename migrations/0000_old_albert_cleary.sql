CREATE TABLE "app_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'main' NOT NULL,
	"base_earnings_per_ad" numeric(10, 2) DEFAULT '0.25',
	"daily_ad_limit" integer DEFAULT 250,
	"min_withdrawal" numeric(10, 2) DEFAULT '2500',
	"max_withdrawal" numeric(10, 2) DEFAULT '100000',
	"withdrawal_cooldown" integer DEFAULT 7,
	"min_ads_for_withdrawal" integer DEFAULT 500,
	"daily_streak_multiplier" numeric(6, 6) DEFAULT '0.002',
	"new_user_bonus" numeric(10, 2) DEFAULT '55',
	"referral_commission_rate" numeric(5, 4) DEFAULT '0.10',
	"sound_enabled" boolean DEFAULT true,
	"background_music" boolean DEFAULT false,
	"music_volume" integer DEFAULT 50,
	"sound_effects" boolean DEFAULT true,
	"current_song_id" varchar,
	"auto_play" boolean DEFAULT false,
	"shuffle_mode" boolean DEFAULT false,
	"repeat_mode" text DEFAULT 'off',
	"total_users" integer DEFAULT 0,
	"total_sats_paid_out" numeric(15, 2) DEFAULT '0',
	"total_ads_watched" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_streaks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_claim_date" timestamp,
	"streak_multiplier" numeric(6, 6) DEFAULT '0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referee_id" varchar NOT NULL,
	"commission" numeric(10, 2) DEFAULT '0',
	"claimed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"filename" text NOT NULL,
	"duration" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"uploaded_by" text NOT NULL,
	"play_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"personal_code" text NOT NULL,
	"withdraw_balance" numeric(10, 2) DEFAULT '55',
	"total_earnings" numeric(10, 2) DEFAULT '55',
	"ads_watched" integer DEFAULT 0,
	"daily_ads_watched" integer DEFAULT 0,
	"daily_earnings" numeric(10, 2) DEFAULT '0',
	"last_ad_watch" timestamp,
	"level" integer DEFAULT 1,
	"referred_by" varchar,
	"flagged" boolean DEFAULT false,
	"flag_reason" text,
	"banned" boolean DEFAULT false,
	"last_login_at" timestamp,
	"last_login_ip" text,
	"last_login_device" text,
	"last_login_user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_personal_code_unique" UNIQUE("personal_code")
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"telegram_username" text,
	"amount" numeric(10, 2) NOT NULL,
	"wallet_address" text NOT NULL,
	"method" text DEFAULT 'lightning',
	"status" text DEFAULT 'pending',
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD CONSTRAINT "daily_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;