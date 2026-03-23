ALTER TYPE "public"."notification_type" ADD VALUE 'candidate_created' BEFORE 'discord_webhook_disabled';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'candidate_deleted' BEFORE 'discord_webhook_disabled';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'candidate_reaction' BEFORE 'discord_webhook_disabled';