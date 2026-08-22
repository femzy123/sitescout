DO $$ BEGIN CREATE TYPE "public"."ai_generation_type" AS ENUM('lead_summary', 'sales_angle', 'call_brief', 'cold_email', 'dm', 'follow_up', 'audit_summary'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."audit_status" AS ENUM('running', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."candidate_state" AS ENUM('new', 'selected', 'added', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."follow_up_status" AS ENUM('pending', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."organization_role" AS ENUM('owner', 'member'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."outreach_direction" AS ENUM('outbound', 'inbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."outreach_outcome" AS ENUM('no_answer', 'voicemail', 'sent', 'replied', 'interested', 'not_interested', 'meeting_booked', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."outreach_type" AS ENUM('call', 'email', 'dm', 'meeting', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."pipeline_stage" AS ENUM('new', 'researching', 'ready_to_contact', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."provenance" AS ENUM('provider', 'website', 'manual', 'ai', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."qualification" AS ENUM('unqualified', 'low', 'medium', 'high', 'hot'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."score_status" AS ENUM('not_scored', 'provisional', 'complete'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."search_status" AS ENUM('running', 'completed', 'partial', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."website_filter" AS ENUM('any', 'missing', 'present', 'unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."website_status" AS ENUM('unknown', 'missing', 'reachable', 'unreachable', 'unsafe'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" "ai_generation_type" NOT NULL,
	"input_hash" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_place_id" text NOT NULL,
	"name" text NOT NULL,
	"formatted_address" text,
	"phone" text,
	"website_url" text,
	"google_maps_url" text,
	"rating" double precision,
	"user_rating_count" integer,
	"primary_category" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"business_status" text,
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manual_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" "provenance" DEFAULT 'provider' NOT NULL,
	"last_provider_sync_at" timestamp with time zone DEFAULT now() NOT NULL,
	"website_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovery_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"search_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"state" "candidate_state" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_results_rank_check" CHECK ("discovery_results"."rank" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovery_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"query" text NOT NULL,
	"location" text NOT NULL,
	"category" text NOT NULL,
	"website_filter" "website_filter" DEFAULT 'any' NOT NULL,
	"target_count" integer NOT NULL,
	"status" "search_status" DEFAULT 'running' NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"provider_page_count" integer DEFAULT 0 NOT NULL,
	"is_partial" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_searches_target_count_check" CHECK ("discovery_searches"."target_count" in (25, 50, 100))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"assigned_to" uuid NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"status" "follow_up_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"audit_id" uuid,
	"rule_score" integer NOT NULL,
	"ai_score" integer,
	"final_score" integer NOT NULL,
	"is_provisional" boolean DEFAULT false NOT NULL,
	"suggested_qualification" "qualification" NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"scoring_version" text DEFAULT 'v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_scores_range_check" CHECK (
    "lead_scores"."rule_score" between 0 and 100 and
    ("lead_scores"."ai_score" is null or "lead_scores"."ai_score" between 0 and 100) and
    "lead_scores"."final_score" between 0 and 100
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"assigned_to" uuid,
	"pipeline_stage" "pipeline_stage" DEFAULT 'new' NOT NULL,
	"qualification" "qualification" DEFAULT 'unqualified' NOT NULL,
	"qualification_overridden" boolean DEFAULT false NOT NULL,
	"score_status" "score_status" DEFAULT 'not_scored' NOT NULL,
	"opportunity_score" integer,
	"website_status" "website_status" DEFAULT 'unknown' NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"lost_reason" text,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_opportunity_score_check" CHECK ("leads"."opportunity_score" is null or ("leads"."opportunity_score" between 0 and 100))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"type" "outreach_type" NOT NULL,
	"direction" "outreach_direction" DEFAULT 'outbound' NOT NULL,
	"outcome" "outreach_outcome",
	"subject" text,
	"body" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"website_url" text,
	"normalized_url" text,
	"status" "audit_status" DEFAULT 'running' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_stage" text DEFAULT 'validating' NOT NULL,
	"performance_score" integer,
	"seo_score" integer,
	"accessibility_score" integer,
	"mobile_score" integer,
	"design_score" integer,
	"business_functionality_score" integer,
	"overall_website_score" integer,
	"technical_findings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"business_findings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_summary" text,
	"error_code" text,
	"error_message" text,
	"duration_ms" integer,
	"audit_version" text DEFAULT 'v1' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_audits_progress_check" CHECK ("website_audits"."progress" between 0 and 100),
	CONSTRAINT "website_audits_scores_check" CHECK (
    ("website_audits"."performance_score" is null or "website_audits"."performance_score" between 0 and 100) and
    ("website_audits"."seo_score" is null or "website_audits"."seo_score" between 0 and 100) and
    ("website_audits"."accessibility_score" is null or "website_audits"."accessibility_score" between 0 and 100) and
    ("website_audits"."mobile_score" is null or "website_audits"."mobile_score" between 0 and 100) and
    ("website_audits"."design_score" is null or "website_audits"."design_score" between 0 and 100) and
    ("website_audits"."business_functionality_score" is null or "website_audits"."business_functionality_score" between 0 and 100) and
    ("website_audits"."overall_website_score" is null or "website_audits"."overall_website_score" between 0 and 100)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_searches_org_id_uidx" ON "discovery_searches" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_id_uidx" ON "leads" USING btree ("organization_id","id");--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discovery_results" ADD CONSTRAINT "discovery_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discovery_results" ADD CONSTRAINT "discovery_results_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discovery_results" ADD CONSTRAINT "discovery_results_search_org_fk" FOREIGN KEY ("organization_id","search_id") REFERENCES "public"."discovery_searches"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discovery_searches" ADD CONSTRAINT "discovery_searches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discovery_searches" ADD CONSTRAINT "discovery_searches_creator_membership_fk" FOREIGN KEY ("organization_id","created_by") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assignee_org_fk" FOREIGN KEY ("organization_id","assigned_to") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_org_fk" FOREIGN KEY ("organization_id","actor_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_audit_id_website_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."website_audits"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_membership_fk" FOREIGN KEY ("organization_id","assigned_to") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notes" ADD CONSTRAINT "notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notes" ADD CONSTRAINT "notes_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notes" ADD CONSTRAINT "notes_author_org_fk" FOREIGN KEY ("organization_id","author_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_actor_org_fk" FOREIGN KEY ("organization_id","actor_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "website_audits" ADD CONSTRAINT "website_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "website_audits" ADD CONSTRAINT "website_audits_lead_org_fk" FOREIGN KEY ("organization_id","lead_id") REFERENCES "public"."leads"("organization_id","id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_generations_input_uidx" ON "ai_generations" USING btree ("lead_id","type","input_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_google_place_id_uidx" ON "businesses" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_name_idx" ON "businesses" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_results_search_business_uidx" ON "discovery_results" USING btree ("search_id","business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovery_results_org_state_idx" ON "discovery_results" USING btree ("organization_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_searches_org_id_uidx" ON "discovery_searches" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovery_searches_org_created_idx" ON "discovery_searches" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_org_due_idx" ON "follow_ups" USING btree ("organization_id","due_at","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_events_lead_occurred_idx" ON "lead_events" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_scores_lead_created_idx" ON "lead_scores" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_business_uidx" ON "leads" USING btree ("organization_id","business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_id_uidx" ON "leads" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_org_stage_idx" ON "leads" USING btree ("organization_id","pipeline_stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_org_qualification_idx" ON "leads" USING btree ("organization_id","qualification");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_org_score_idx" ON "leads" USING btree ("organization_id","opportunity_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_org_follow_up_idx" ON "leads" USING btree ("organization_id","next_follow_up_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_lead_created_idx" ON "notes" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_lead_occurred_idx" ON "outreach_activities" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_uidx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "website_audits_active_uidx" ON "website_audits" USING btree ("organization_id","lead_id","normalized_url") WHERE "website_audits"."status" = 'running';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_audits_lead_created_idx" ON "website_audits" USING btree ("lead_id","created_at");
