CREATE TABLE "route_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"encoded_polyline" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_cache_cache_key_unique" UNIQUE("cache_key")
);
