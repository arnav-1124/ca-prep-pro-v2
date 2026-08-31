ALTER TYPE "public"."plan_enum" ADD VALUE 'PLUS' BEFORE 'PAID';--> statement-breakpoint
ALTER TYPE "public"."plan_enum" ADD VALUE 'PRO' BEFORE 'PAID';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "razorpay_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan" "plan_enum" DEFAULT 'FREE' NOT NULL;