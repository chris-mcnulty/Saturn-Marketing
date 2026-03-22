CREATE TABLE "markets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_product_tags" (
	"asset_id" integer NOT NULL,
	"product_tag_id" integer NOT NULL,
	CONSTRAINT "asset_product_tags_asset_id_product_tag_id_pk" PRIMARY KEY("asset_id","product_tag_id")
);
--> statement-breakpoint
CREATE TABLE "brand_asset_product_tags" (
	"brand_asset_id" integer NOT NULL,
	"product_tag_id" integer NOT NULL,
	CONSTRAINT "brand_asset_product_tags_brand_asset_id_product_tag_id_pk" PRIMARY KEY("brand_asset_id","product_tag_id")
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"market_id" integer,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grounding_documents" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "brand_asset_categories" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "generated_emails" ADD COLUMN "market_id" integer;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_product_tags" ADD CONSTRAINT "asset_product_tags_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_product_tags" ADD CONSTRAINT "asset_product_tags_product_tag_id_product_tags_id_fk" FOREIGN KEY ("product_tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset_product_tags" ADD CONSTRAINT "brand_asset_product_tags_brand_asset_id_brand_assets_id_fk" FOREIGN KEY ("brand_asset_id") REFERENCES "public"."brand_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset_product_tags" ADD CONSTRAINT "brand_asset_product_tags_product_tag_id_product_tags_id_fk" FOREIGN KEY ("product_tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset_categories" ADD CONSTRAINT "brand_asset_categories_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD CONSTRAINT "generated_posts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_emails" ADD CONSTRAINT "generated_emails_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;