ALTER TABLE "session" ADD COLUMN "login_mode" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "login_days" integer;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "use_gravatar" boolean DEFAULT false;