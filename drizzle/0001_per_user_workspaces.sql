DROP INDEX IF EXISTS "organization_members_user_idx";--> statement-breakpoint
ALTER TABLE IF EXISTS "organizations" ALTER COLUMN "timezone" SET DEFAULT 'UTC';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_organization_uidx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_user_uidx" ON "organization_members" USING btree ("user_id");
