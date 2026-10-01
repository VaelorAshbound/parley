// `node scripts/bench-history.ts`: the query plans and timings of the draft
// history (the sidebar, the next page, search, the type filter) on a
// throwaway Postgres 18 with many users' drafts. T22 measured with it; T35
// runs it again next to `neon inspect db` (spec §5 Database → Checks).
import { sql, type SQLWrapper } from "drizzle-orm"

import { connect, type Db } from "../src/client.ts"
import { listDraftsQuery } from "../src/queries/drafts.ts"
import { startTestDatabase } from "../testing/index.ts"

const users = 5000
/** Drafts of the heavy user the queries run for; everyone else has 1–15. */
const heavyDrafts = 2000

const database = await startTestDatabase()
const db = await connect(database.url)
try {
  await seed(db)
  const heavy = "bench-heavy"
  const typical = "bench-user-7"
  const [last] = await listDraftsQuery(db, { userId: heavy, limit: 50 })
  const queries = {
    "sidebar (heavy user)": listDraftsQuery(db, { userId: heavy, limit: 30 }),
    "sidebar (typical user)": listDraftsQuery(db, {
      userId: typical,
      limit: 30,
    }),
    "next page (heavy user)": listDraftsQuery(db, {
      userId: heavy,
      after: last,
    }),
    "search, a common word (heavy user)": listDraftsQuery(db, {
      userId: heavy,
      query: "acme",
    }),
    "search, a rare word (heavy user)": listDraftsQuery(db, {
      userId: heavy,
      query: "quok",
    }),
    "search, two words (heavy user)": listDraftsQuery(db, {
      userId: heavy,
      query: "bolt ret",
    }),
    "search (typical user)": listDraftsQuery(db, {
      userId: typical,
      query: "acme",
    }),
    "type filter (heavy user)": listDraftsQuery(db, {
      userId: heavy,
      documentId: "pilot-agreement",
    }),
  }
  for (const [name, query] of Object.entries(queries)) {
    // Once to warm the cache, then the measured run.
    await explain(db, query)
    console.log(`\n## ${name}\n${await explain(db, query)}`)
  }
} finally {
  await db.$client.end()
  await database.stop()
}

async function explain(db: Db, query: SQLWrapper) {
  const plan = await db.execute<{ "QUERY PLAN": string }>(
    sql`EXPLAIN (ANALYZE, BUFFERS) ${query}`
  )
  return plan.rows.map((row) => row["QUERY PLAN"]).join("\n")
}

async function seed(db: Db) {
  await db.execute(sql`
    INSERT INTO "user" (id, name, email)
    SELECT 'bench-user-' || n, 'User ' || n, 'user-' || n || '@example.test'
    FROM generate_series(1, ${users}) AS n`)
  await db.execute(sql`
    INSERT INTO "user" (id, name, email)
    VALUES ('bench-heavy', 'Heavy', 'heavy@example.test')`)
  const companies = sql`(ARRAY['Acme Analytics', 'Bolt Retail', 'Zenith Labs',
    'Northwind Traders', 'Globex', 'Initech', 'Umbrella Health', 'Stark Cloud',
    'Wayne Logistics', 'Hooli'])`
  const documents = sql`(ARRAY['mutual-nda', 'csa', 'sla', 'dpa',
    'pilot-agreement', 'psa'])`
  const draftsFor = (userId: SQLWrapper, count: SQLWrapper) => sql`
    INSERT INTO draft (user_id, document_id, title, fields, updated_at)
    SELECT ${userId}, ${documents}[1 + n % 6], 'Draft ' || n,
      jsonb_build_object(
        'party1', jsonb_build_object('company', ${companies}[1 + n % 10], 'name', 'Person ' || n),
        'party2', jsonb_build_object('company', ${companies}[1 + (n * 7) % 10])),
      timestamptz '2026-01-01' + n * interval '1 minute'
    FROM generate_series(1, ${count}) AS n`
  await db.execute(sql`
    DO $$ BEGIN
      FOR i IN 1..${sql.raw(String(users))} LOOP
        ${draftsFor(sql.raw(`'bench-user-' || i`), sql.raw("1 + i % 15"))};
      END LOOP;
    END $$`)
  await db.execute(
    draftsFor(sql.raw("'bench-heavy'"), sql.raw(String(heavyDrafts)))
  )
  await db.execute(sql`
    INSERT INTO draft (user_id, document_id, title, fields)
    VALUES ('bench-heavy', 'mutual-nda', 'NDA',
      '{"party1": {"company": "Quokka Systems"}}')`)
  await db.execute(sql`VACUUM ANALYZE draft`)
  const [count] = (
    await db.execute<{ count: string }>(sql`SELECT count(*) FROM draft`)
  ).rows
  console.log(`Seeded ${count?.count} drafts for ${users + 1} users.`)
}
