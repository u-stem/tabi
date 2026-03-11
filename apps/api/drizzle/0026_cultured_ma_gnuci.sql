CREATE TABLE "expense_line_item_members" (
	"line_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "expense_line_item_members_line_item_id_user_id_pk" PRIMARY KEY("line_item_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "expense_line_item_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expense_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"amount" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_line_item_members" ADD CONSTRAINT "expense_line_item_members_line_item_id_expense_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."expense_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_item_members" ADD CONSTRAINT "expense_line_item_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_items" ADD CONSTRAINT "expense_line_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_line_items_expense_id_idx" ON "expense_line_items" USING btree ("expense_id");