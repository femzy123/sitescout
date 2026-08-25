DO $$
BEGIN
  ALTER TYPE "public"."provenance" ADD VALUE 'import';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."lead_import_status" AS ENUM (
    'processing',
    'completed',
    'partial',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ADD COLUMN IF NOT EXISTS "external_source" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ADD COLUMN IF NOT EXISTS "normalized_domain" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ADD COLUMN IF NOT EXISTS "normalized_name" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ADD COLUMN IF NOT EXISTS "normalized_address" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ALTER COLUMN "google_place_id" DROP NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "businesses_google_place_id_uidx";
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "businesses" WHERE "organization_id" IS NULL) THEN
    CREATE TEMP TABLE "sitescout_business_org_map" (
      "old_business_id" uuid NOT NULL,
      "organization_id" uuid NOT NULL,
      "new_business_id" uuid NOT NULL DEFAULT gen_random_uuid(),
      PRIMARY KEY ("old_business_id", "organization_id")
    ) ON COMMIT DROP;

    INSERT INTO "sitescout_business_org_map" ("old_business_id", "organization_id")
    SELECT DISTINCT refs."business_id", refs."organization_id"
    FROM (
      SELECT "business_id", "organization_id" FROM "discovery_results"
      UNION
      SELECT "business_id", "organization_id" FROM "leads"
    ) refs
    INNER JOIN "businesses" business ON business."id" = refs."business_id"
    WHERE business."organization_id" IS NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO "businesses" (
      "id", "organization_id", "google_place_id", "name", "formatted_address",
      "phone", "website_url", "google_maps_url", "rating", "user_rating_count",
      "primary_category", "categories", "latitude", "longitude", "business_status",
      "provider_data", "manual_overrides", "source", "last_provider_sync_at",
      "website_checked_at", "created_at", "updated_at"
    )
    SELECT
      mapping."new_business_id", mapping."organization_id", business."google_place_id",
      business."name", business."formatted_address", business."phone",
      business."website_url", business."google_maps_url", business."rating",
      business."user_rating_count", business."primary_category", business."categories",
      business."latitude", business."longitude", business."business_status",
      business."provider_data", business."manual_overrides", business."source",
      business."last_provider_sync_at", business."website_checked_at",
      business."created_at", business."updated_at"
    FROM "sitescout_business_org_map" mapping
    INNER JOIN "businesses" business ON business."id" = mapping."old_business_id";

    UPDATE "discovery_results" result
    SET "business_id" = mapping."new_business_id"
    FROM "sitescout_business_org_map" mapping
    WHERE result."business_id" = mapping."old_business_id"
      AND result."organization_id" = mapping."organization_id";

    UPDATE "leads" lead
    SET "business_id" = mapping."new_business_id"
    FROM "sitescout_business_org_map" mapping
    WHERE lead."business_id" = mapping."old_business_id"
      AND lead."organization_id" = mapping."organization_id";

    DELETE FROM "businesses" WHERE "organization_id" IS NULL;
  END IF;
END $$;
--> statement-breakpoint
UPDATE "businesses"
SET
  "normalized_name" = NULLIF(
    regexp_replace(lower(btrim("name")), '[[:space:]]+', ' ', 'g'),
    ''
  ),
  "normalized_address" = NULLIF(
    regexp_replace(lower(btrim("formatted_address")), '[[:space:]]+', ' ', 'g'),
    ''
  ),
  "normalized_domain" = NULLIF(
    regexp_replace(
      split_part(
        regexp_replace(lower(btrim("website_url")), '^https?://', '', 'i'),
        '/',
        1
      ),
      '^www\.',
      '',
      'i'
    ),
    ''
  )
WHERE
  "normalized_name" IS NULL
  OR ("formatted_address" IS NOT NULL AND "normalized_address" IS NULL)
  OR ("website_url" IS NOT NULL AND "normalized_domain" IS NULL);
--> statement-breakpoint
ALTER TABLE IF EXISTS "businesses" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "businesses"
    ADD CONSTRAINT "businesses_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_org_id_uidx"
  ON "businesses" USING btree ("organization_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_org_google_place_uidx"
  ON "businesses" USING btree ("organization_id", "google_place_id")
  WHERE "google_place_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_org_external_uidx"
  ON "businesses" USING btree ("organization_id", "external_source", "external_id")
  WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_org_domain_idx"
  ON "businesses" USING btree ("organization_id", "normalized_domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_org_name_address_idx"
  ON "businesses" USING btree ("organization_id", "normalized_name", "normalized_address");
--> statement-breakpoint
DROP INDEX IF EXISTS "businesses_name_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_org_name_idx"
  ON "businesses" USING btree ("organization_id", "name");
--> statement-breakpoint
ALTER TABLE IF EXISTS "discovery_results"
  DROP CONSTRAINT IF EXISTS "discovery_results_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "leads"
  DROP CONSTRAINT IF EXISTS "leads_business_id_businesses_id_fk";
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "discovery_results"
    ADD CONSTRAINT "discovery_results_business_org_fk"
    FOREIGN KEY ("organization_id", "business_id")
    REFERENCES "public"."businesses"("organization_id", "id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_business_org_fk"
    FOREIGN KEY ("organization_id", "business_id")
    REFERENCES "public"."businesses"("organization_id", "id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "file_name" text NOT NULL,
  "source_name" text NOT NULL,
  "status" "lead_import_status" DEFAULT 'processing' NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "processed_rows" integer DEFAULT 0 NOT NULL,
  "created_count" integer DEFAULT 0 NOT NULL,
  "updated_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "rejected_count" integer DEFAULT 0 NOT NULL,
  "column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lead_imports_counts_check" CHECK (
    "total_rows" >= 0 AND "processed_rows" >= 0 AND "created_count" >= 0
    AND "updated_count" >= 0 AND "skipped_count" >= 0 AND "rejected_count" >= 0
    AND "processed_rows" <= "total_rows"
  )
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "lead_imports"
    ADD CONSTRAINT "lead_imports_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "lead_imports"
    ADD CONSTRAINT "lead_imports_creator_membership_fk"
    FOREIGN KEY ("organization_id", "created_by")
    REFERENCES "public"."organization_members"("organization_id", "user_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_imports_org_created_idx"
  ON "lead_imports" USING btree ("organization_id", "created_at");
