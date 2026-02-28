CREATE TABLE "app_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"signup_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "app_settings_single_row" CHECK ("id" = 1)
);
--> statement-breakpoint
INSERT INTO "app_settings" ("id", "signup_enabled") VALUES (1, true);
