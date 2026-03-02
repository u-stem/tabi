CREATE TYPE "public"."weather_type" AS ENUM('sunny', 'partly_cloudy', 'cloudy', 'mostly_cloudy', 'light_rain', 'rainy', 'heavy_rain', 'thunder', 'snowy', 'sleet', 'foggy');--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN "weather_type" "weather_type";--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN "weather_type_secondary" "weather_type";--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN "temp_high" smallint;--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN "temp_low" smallint;
