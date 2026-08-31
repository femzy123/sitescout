# Discovery Upsert Repair Design

## Problem

Discovery receives valid Google Places results but fails while persisting the first business. The `businesses` table enforces organization-scoped Google Place uniqueness with the partial unique index `businesses_org_google_place_uidx`:

```sql
UNIQUE (organization_id, google_place_id)
WHERE google_place_id IS NOT NULL
```

The Drizzle upsert targets only `(organization_id, google_place_id)`. PostgreSQL cannot infer a partial unique index unless the conflict target includes a predicate that implies the index predicate, so it rejects the query before inserting or updating the business.

## Goals

- Restore discovery persistence for new and previously discovered Google Places.
- Preserve organization isolation and the existing nullable `google_place_id` model used by imported businesses.
- Avoid an unnecessary production schema migration.
- Prevent the conflict-target mismatch from recurring.
- Avoid returning raw SQL parameters and business data to browser clients on failures.

## Non-goals

- Redesigning discovery pagination or ranking.
- Changing business deduplication rules for imports.
- Replacing the existing organization-scoped unique indexes.
- Refactoring unrelated discovery UI behavior.

## Design

### Application upsert

Keep the current partial unique index. Update the discovery business upsert so its conflict target includes the same `google_place_id IS NOT NULL` predicate as the index. The incoming Google Places branch already rejects entries without a Place ID, so the predicate is always true for this path and accurately declares which database uniqueness rule PostgreSQL should use.

The update branch continues refreshing provider-controlled fields while retaining organization-scoped identity. A repeated Place ID in the same organization updates the existing business; the same Place ID in another organization remains a separate business.

### Database verification

Do not add a migration when the deployed database already matches `drizzle/0002_lead_intake.sql`. Verify that production has `businesses_org_google_place_uidx` on `(organization_id, google_place_id)` with `WHERE google_place_id IS NOT NULL` and that migration `0002` completed.

If verification finds schema drift, repair the deployed schema by applying the existing migration or restoring that exact index definition. Do not replace the partial index merely to make the unqualified application query succeed.

### Error handling

The discovery API should return a stable, user-facing failure message rather than serializing the database driver's complete error text. Detailed database errors remain available in server logs for diagnosis. This prevents addresses, phone numbers, provider metadata, and SQL parameters from being exposed in API responses.

## Testing

- Add a regression test that inspects the generated discovery upsert and confirms its conflict target includes the partial-index predicate before `DO UPDATE`.
- Verify a duplicate Google Place within one organization follows the update path.
- Verify identical Google Place IDs across different organizations do not conflict.
- Verify businesses with null Google Place IDs remain valid for import workflows.
- Run the focused tests, full unit suite, typecheck, and lint. Run the production build if those checks pass.

## Deployment and rollback

Deploy the application change without a new database migration after confirming the existing index. The change is backward-compatible with the current schema. Rollback consists of reverting the application change; no data or schema rollback is required.

## Success criteria

- A discovery search persists Google Places and returns candidates instead of failing on the business upsert.
- Repeating a discovery search does not create duplicate businesses within the same organization.
- Cross-organization data remains isolated.
- Client-visible errors contain no raw SQL or bound parameter values.
