# PAR-5 design: old drafts after a definition change

Status: proposed (design only, no code yet). Date: 2026-10-03.

## 1. The problem, in one picture

A draft stores its answers in `draft.fields` (jsonb). Every read runs
`definition.draftSchema.parse(draft.fields)`. That schema is strict.
So if a definition changes shape, an old draft **throws on every read**:

| Where it throws today | File |
|---|---|
| Edit a field (`updateFields`) | `apps/web/src/server/rpc/drafts.ts:229` |
| `markComplete` | `apps/web/src/server/rpc/drafts.ts:269` |
| Every chat turn | `apps/web/src/server/ai/chat.ts:470` |
| Export (PDF/DOCX) | `apps/web/src/server/rpc/export.ts:100` |
| Share link | `apps/web/src/server/rpc/share.ts:100` |
| Live preview | `apps/web/src/routes/-components/shell/document-panel.tsx:159` |
| Optimistic edit | `apps/web/src/features/field-editor/use-save-field.ts:76` |
| Undo | `apps/web/src/features/chat/use-undo.ts:58` |
| Share page | `apps/web/src/features/share/share-page.tsx:90` |

The user cannot fix it: the edit that would fix it also throws.

What exists today:

- Every definition has `version: 1` (`packages/documents/src/define.ts:87`).
  The comment says "stored drafts carry it (T13)". **They don't.**
  The `draft` table has no version column. ADR-0003 says the same.
- It already happened once. Commit `ae9f683`: a new rule ("Oregon is a US
  state") sat on the draft schema, so old drafts with `region: "Oregon"`
  threw everywhere. The fix moved the rule to `changeSchema` (writes only).
- `formatChoice` already guards a dropped option. `switchDocument` already
  reads values one field at a time and keeps what fits. Good patterns to reuse.

## 2. What is a "breaking" change?

Breaking = an old stored draft no longer parses, **or** parses but means
something else.

| Change | Breaking? | What to do |
|---|---|---|
| Add an optional field | No | Nothing. |
| Add a required field | No (drafts are partial) | Nothing. `missingFields` asks for it. |
| Change label, help, default | No | Nothing. Defaults only seed new drafts. |
| Add a choice option | No | Nothing. |
| Loosen a rule | No | Nothing. |
| Tighten a rule (max length, regex, new cross-field rule) | Yes, if it sits on `draftSchema` | Put it on `changeSchema` only (like `ae9f683`). No bump. |
| Rename a field or a part (`party.company`) | Yes | Bump + migration step. |
| Remove a field | Yes (strict object refuses unknown keys) | Bump + step moves the value to "kept". |
| Retype a field (text to choice, number to duration) | Yes | Bump + step converts, or keeps. |
| Remove or rename a choice option | Yes | Bump + step maps the option, or keeps. |
| Same shape, new meaning (days become months) | Yes, and **silent** | Bump + step converts. No test can catch this: reviewer checks it. |

Rule of thumb: **if an old value could fail or mislead, bump the version.**

## 3. Two layers

1. **Safety net (always on).** One function reads a stored draft and
   **never throws**. Values that don't fit are flagged, not dropped.
   This alone fixes the bug in PAR-5.
2. **Migrations (per version).** When a definition bumps from N to N+1, a
   step turns old values into new ones. Used for real shape changes.

### 3.1 The one read function

New, in `packages/documents/src/read.ts`, shared by server and client:

```ts
/** A stored value that the current document can't use. Never dropped. */
export type KeptValue = {
  key: string        // the stored key ("region", or an old field name)
  value: unknown     // exactly as stored
  reason: string     // plain words: "No longer in this agreement."
}

export type ReadDraft<F extends Fields> = {
  values: DraftValues<F>  // only what fits: safe to render, edit, export
  kept: KeptValue[]       // everything else
}

/** Reads stored fields. Never throws, never loses a value. */
export function readDraft<F extends Fields>(
  definition: DocumentDefinition<F>,
  stored: { fields: unknown; version?: number }
): ReadDraft<F>
```

How it reads (same idea as `switchDocument`):

1. If `stored.fields` is not an object: everything goes to `kept`.
2. Run migration steps from `stored.version` (absent = 1) up to
   `definition.version` (section 4).
3. Try `draftSchema` on the whole object. Success: done, `kept = []`
   (the fast, normal path).
4. Else, field by field: unknown key goes to `kept` ("No longer in this
   agreement."). A value that fails its field schema goes to `kept` with the
   Zod message. A cross-field rule issue names a field: that field goes to
   `kept`.

All 9 call sites in the table above switch to `readDraft`.

### 3.2 Writing back

- A **read** (get, chat turn, export, share, preview) never writes.
  Reads stay side-effect free; the share page is anonymous and must not write.
- A **write** (`updateFields`, `markComplete`, `chooseDocument`) already
  locks the row. It saves the new `values` **plus the kept values**, so the
  next read sees them again.
- In slice 1 (still version 1), kept values stay **in place** under their
  own key in `fields`. Same version means same meaning, so leaving
  `region: "Oregon"` there is safe. A new edit to that field replaces it:
  that is the user's own choice, not a silent loss.
- From the first real bump on, kept values need their own place (a migrated
  key would otherwise be read again with a new meaning). See section 5.

## 4. Migration steps

### 4.1 How a step is written

Each definition gets an optional `migrations` list. Step `to: 2` turns
version 1 into version 2.

```ts
export type Migration = {
  /** The version this step produces. It reads version `to - 1`. */
  to: number
  /** One line, plain words. Shown to the AI and in logs. */
  note: string
  /** Input is raw stored JSON: treat it as unknown. Must not throw. */
  up(old: Readonly<Record<string, unknown>>): {
    values: Record<string, unknown>
    kept: KeptValue[]
  }
}
```

Example (made up): the NDA renames `purpose` to `businessPurpose` and drops
the `modifications` field.

```ts
// packages/documents/src/definitions/mutual-nda.ts
migrations: [
  {
    to: 2,
    note: "Purpose is now Business Purpose; Modifications was removed.",
    up: ({ purpose, modifications, ...rest }) => ({
      values: { ...rest, ...(purpose !== undefined && { businessPurpose: purpose }) },
      kept: modifications === undefined ? [] : [
        { key: "modifications", value: modifications,
          reason: "Modifications is no longer a field of this agreement." },
      ],
    }),
  },
],
```

Rules for a step:

- Touch every key it changes **explicitly**. Never leave an old value under
  a key whose meaning changed.
- Can't convert a value? Put it in `kept` with a reason. Never drop it.
- Pure function. No I/O, no dates from the clock.
- Small helpers can come later (`renameField`, `mapOption`) once two steps
  need them. Not before.

`defineDocument` checks at build time: steps are `to: 2, 3, … version`, with
no gaps (`version === 1 + migrations.length`). A gap fails at startup, like
`checkLayout` does today.

If a step throws anyway (a bug): `readDraft` catches it, logs
`draft_migration_failed` (error), and falls back to the field-by-field read
of the old values. Nothing is written over the stored draft by a read.

### 4.2 When it runs, and why

| Option | Verdict |
|---|---|
| **On read, in memory** | **Yes.** Pure and cheap (microseconds). Always right, whatever the deploy timing. |
| **Saved on the next write** | **Yes.** Inside the existing row lock. No extra writes. |
| One-off job over all drafts | Not now. Code and data disagree while it runs; it needs a script on the protected production branch; most drafts are never opened again (guests are purged). Can be added later: it would call the same `readDraft`. |

A newer draft read by older code (a rollback, or a gradual deploy): if
`stored.version > definition.version`, `readDraft` returns the values it can
read, and **writes refuse** with "Parley was updated. Reload the page."
Older code never writes over newer data.

## 5. Where the version is stored

Today: nowhere. Absent means 1. All definitions are at 1, so **slice 1 and
slice 2 need no storage change and no DB migration.**

The first real bump (some later wave) needs two things stored per draft:
the version, and the kept values. Two ways:

| | A. New columns (recommended) | B. Keys inside `fields` |
|---|---|---|
| Shape | `fields_version smallint not null default 1`, `kept_fields jsonb not null default '[]'` | `fields.$version`, `fields.$kept` |
| DB migration | Yes (additive, safe, `default` fills old rows) | No |
| Rollback-safe | Yes: old code ignores new columns | No: old code's strict parse throws on `$version` |
| Clean | Yes | Mixes metadata with answers; search column indexes `$kept` too |

This wave allows no DB migration, so this is **an owner question** (below).
Nothing in slices 1 and 2 depends on the answer.

## 6. What the AI and the editor see

| Who | Sees |
|---|---|
| Editor (document panel) | Values that fit, as normal. Under a field with a kept value: a small note, "Your earlier answer: *Oregon*. It doesn't fit anymore: That's a US state." Actions: **Use as a starting point** (opens the field with it) and **Discard** (explicit). |
| Editor, removed fields | One note above the document: "Some answers from an older version of this agreement are kept here." Each one with Copy and Discard. |
| AI (system prompt) | The current values, plus a short section: "Kept from an older version, not in the document: modifications = '…' (no longer a field). Ask the user before using them." Plus each migration `note` since the draft's stored version. |
| AI tool results | Unchanged. `updateFields` only accepts current keys, so an old key gets today's clear refusal ("There is no field …"). |
| Old Undo buttons in the chat | An undo of an edit made before a migration may not fit. It is refused with today's message ("This field changed after that edit, so it was not undone."). Nothing is overwritten. |
| Share page | Current values only. No kept values: the viewer is not the owner. |
| Export | Current values only. `missingFields` still blocks an incomplete document. |

Discard is the only way a kept value is deleted. It is a user action and is
logged (`draft_kept_discarded`, key only, never the value).

A stale browser tab (old bundle, new server data): the client calls
`readDraft` too, so it shows what it can and never crashes.

## 7. Tests that prove it

All in Vitest. The DB ones run on real Postgres (ADR-0004).

| # | Test | Proves |
|---|---|---|
| 1 | `readDraft` with the `ae9f683` case: `{ region: "Oregon" }` | No throw; value lands in `kept` with the Zod reason. |
| 2 | `readDraft` with an unknown key, a wrong type, a broken cross-field rule, `null`, an array, a string | Never throws; every input field is in `values` or `kept`. |
| 3 | `readDraft` on each `examples.ts` draft | Fast path: `kept` is empty, values unchanged. |
| 4 | **Shape guard** (per definition): `z.toJSONSchema(draftSchema)` equals the committed snapshot `test/__versions__/<id>/v<N>.json` | A shape change without a bump fails CI with: "Bump `version` and add a migration, or update the snapshot if old drafts still parse." (`prompt.ts` already uses `toJSONSchema` on these schemas.) |
| 5 | **Old fixtures**: for each stored `test/__versions__/<id>/v<K>.example.json`, `readDraft` to the current version | Every old version still reads and renders. |
| 6 | **Nothing lost** (generic, every step): each filled key of the old draft ends up in `values` or `kept` | Steps can't drop data. |
| 7 | Step chain check: `to` runs 2..version with no gaps | Caught at build time. |
| 8 | DB + router: insert a raw stale row with SQL, call `updateFields` on another field | Edit succeeds; the kept value is still stored after the write. |
| 9 | Router: `stored.version > definition.version` | Read works; write refuses with the reload message. |
| 10 | Playwright: open a seeded stale draft | Preview renders, note shows, editing a field works, chat turn works. |

Tests 4 to 7 come with slice 2. Test 4 is the one that stops the next
`ae9f683` before it ships.

## 8. First slice (small, no DB migration, no version bump)

**Slice 1: the safety net.** Fixes the reported bug.

- [ ] `readDraft` in `packages/documents` (section 3.1), exported.
  Tests 1, 2, 3.
- [ ] Replace the 5 server call sites with `readDraft`. Writes keep the
  in-place kept values (section 3.2). Test 8.
- [ ] Replace the 4 client call sites with `readDraft`.
- [ ] Log `draft_read_kept` (warn) with `documentId`, `version`, count and
  keys. Never the values (they are user data).

Files: about 10, all small. No API shape change: the client runs the same
pure function on the same row.

Later slices:

- **Slice 2:** `migrations` on `defineDocument`, the step runner, the shape
  guard and fixtures (tests 4 to 7). Pure package code, still no DB change.
- **Slice 3:** the editor notes, Discard, and the AI prompt section (section 6).
- **Slice 4** (needs the owner's answer on section 5): store version and
  kept values, the "newer draft" write refusal (test 9), then the first
  real version 2.

Not covered: a draft whose `documentId` is removed from the registry.
That is a different problem (a new work item if it ever happens).

## 9. Owner questions

1. **Storage for the first real bump** (section 5): add two columns
   (`fields_version`, `kept_fields`; one additive DB migration in a later
   wave), or keys inside `fields` (no migration, not rollback-safe)?
   Recommended: columns.
2. **Kept values lifetime:** keep them until the user discards them or
   deletes the draft? (Recommended: yes, no expiry.)
3. **A completed draft that a migration makes incomplete:** it drops back to
   "drafting" on its next write, and export asks for the missing fields.
   Already-counted exports stay free. OK?
4. **Order:** build slice 1 now, and slices 2 to 4 only when a real
   definition change is planned? (Recommended: slices 1 and 2 now, because
   the shape guard prevents the next silent break.)
