CREATE TABLE IF NOT EXISTS "brand_asset_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN IF NOT EXISTS "category_id" integer;--> statement-breakpoint
ALTER TABLE "brand_asset_categories" ADD CONSTRAINT "brand_asset_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_category_id_brand_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."brand_asset_categories"("id") ON DELETE set null ON UPDATE no action;
