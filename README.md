# SiteScout

SiteScout is an AI-assisted prospecting command center for a web-development agency. It discovers local businesses, turns selected candidates into leads, audits weak or missing websites, explains opportunity scores, prepares outreach, and tracks follow-ups through Won or Lost.

## Architecture

SiteScout uses a single deployment:

```text
Browser
  └─ Next.js application on Vercel
       ├─ Clerk identity and isolated per-user organizations
       ├─ Google Places discovery
       ├─ Streamed Playwright + Lighthouse website audit
       ├─ Gemini assessment and outreach assistance
       └─ Drizzle ORM → Neon PostgreSQL
```

There is no Railway service, queue provider, persistent worker, or database polling loop. Every audit is explicitly requested and runs as one bounded Vercel Node.js request. Bulk analysis submits up to 20 lead audits sequentially from the open browser page.

## Local setup

1. Copy `.env.example` to `.env.local` and populate the values.
2. Run `npm run db:migrate` to apply every committed database migration.
3. If you prefer the Neon SQL Editor, apply the numbered files in `drizzle/` in order.
4. Complete the provider tasks in `SETUP_TASKS.md`.
5. Start the app with `npm run dev`.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Product invariants

- Discovery never creates leads automatically.
- Expensive website/AI analysis requires explicit selection.
- Bulk audits run sequentially and preserve partial success.
- Clerk establishes identity; local organization membership authorizes data.
- Every Clerk user owns one private organization; organizations support one member in V1.
- Tenant-owned queries and composite foreign keys prevent cross-organization access.
- AI uses structured deterministic evidence and never sends outreach.
- Audit and score history is immutable; retries create new snapshots.

See `SPEC.md` for the complete product and engineering specification and `design-system/MASTER.md` for the Signal Room visual language.
