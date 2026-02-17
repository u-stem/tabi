CREATE TYPE "public"."bookmark_list_visibility" AS ENUM('private', 'friends_only', 'public');--> statement-breakpoint
CREATE TABLE "bookmark_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"visibility" "bookmark_list_visibility" DEFAULT 'private' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmark_lists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"memo" text,
	"url" varchar(2000),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmark_lists" ADD CONSTRAINT "bookmark_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_list_id_bookmark_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."bookmark_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_lists_user_sort_idx" ON "bookmark_lists" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "bookmarks_list_sort_idx" ON "bookmarks" USING btree ("list_id","sort_order");