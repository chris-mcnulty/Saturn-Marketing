CREATE TABLE "generated_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"platform" text NOT NULL,
	"email_body" text NOT NULL,
	"subject_line_suggestions" jsonb NOT NULL,
	"coaching_tips" jsonb NOT NULL,
	"asset_titles" jsonb NOT NULL,
	"asset_ids" jsonb NOT NULL,
	"tone" text,
	"call_to_action" text,
	"recipient_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_emails" ADD CONSTRAINT "generated_emails_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;