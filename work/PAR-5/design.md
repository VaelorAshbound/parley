# PAR-5 design: old drafts after a definition change

Status: proposed, revision 2 (design only, no code yet). Date: 2026-10-03.
Revision 2 fixes the review findings: data loss on fields with parts, the
version stamp on new rows, the shape guard, and the tests.

## 0. What the user sees, slice by slice

- **After slice 1:** an old draft opens again, and so do editing, chat,
  export and sharing. If an answer no longer fits, it is not shown in the
  document, but it is kept. A short line under the field says
  "Earlier answer: Oregon. It no longer fits." The AI knows about it too,
  and asks before it replaces it.
- **After slice 2:** CI fails when someone changes a document in a way that
  breaks real old drafts. Nothing changes for the user.
- **After slice 3:** the line under the field gets two buttons,
  **Use as a starting point** and **Discard**. Answers to removed fields are
  listed above the document.
- **After slice 4** (only when the first real version 2 is planned): the
  draft stores its version, and old answers are converted to the new shape
  the first time the draft is opened.

## 1. The problem

A draft stores its answers in `draft.fields`. Every read checks them against
the document's draft rules, and the check is strict. So when a document
definition changes shape, an old draft **fails on every read**. The user
cannot fix it, because the edit that would fix it fails too.

Places that read stored answers today:

| Where | File |
|---|---|
| Edit a field | `apps/web/src/server/rpc/drafts.ts:229` |
| Mark complete | `apps/web/src/server/rpc/drafts.ts:269` |
| Every chat turn | `apps/web/src/server/ai/chat.ts:470` |
| Export (PDF/DOCX) | `apps/web/src/server/rpc/export.ts:100` |
| Share link | `apps/web/src/server/rpc/share.ts:100` |
| Live preview | `apps/web/src/routes/-components/shell/document-panel.tsx:159` |
| Edit in the browser (before the server answers) | `apps/web/src/features/field-editor/use-save-field.ts:76` |
| Undo | `apps/web/src/features/chat/use-undo.ts:58` |
| Share page | `apps/web/src/features/share/share-page.tsx:90` |
| **Old chat messages** show `change.after` with today's `format` | `apps/web/src/features/chat/message-parts.tsx:338` (`shown`) |
| **Chat sync** writes `after` straight into the cache | `apps/web/src/features/chat/use-document-sync.ts` |

What we know:

- Every definition says `version: 1` (`packages/documents/src/define.ts:87`),
  and the comment says drafts store it. **They don't.** The `draft` table has
  no version column.
- It already broke twice:
  - **ae9f683:** a new rule "Oregon is a US state, pick it as the state" sat
    on the draft rules. Stored drafts had
    `governingLaw: { region: "Oregon", courtLocation: "Portland" }` and failed
    everywhere. The fix moved the rule to edits only.
  - **2026-09-24 (490bb80, c250b72, 6ba0a64, and others):** seven fields
    went from `field.choice` to `field.select`: DPA `governingMemberState`,
    `ukTransfers`, `customerRole`; the Pilot's `start` and `cadence` blanks
    (inside the `paymentProcess` choice); BAA `providerRole`, `companyRole`.
    Stored `{ option: "controller" }` became `"controller"`. The same commits
    added "required when" rules for finished documents, which quietly made
    some **complete** drafts incomplete.

## 2. Which changes break old drafts?

Breaking = an old draft no longer passes the draft rules, **or** it passes
but means something else.

| Change | Breaking? | What to do |
|---|---|---|
| Add a field (optional or required) | No | Nothing. Drafts may be partial. |
| Change label, help text, default | No | Nothing. The shape guard ignores them (section 7). |
| Add a choice option, loosen a rule | No | Nothing. |
| Tighten a **single-field** rule | Yes, if on the draft rules | Put it on the edit rules only (`changeSchema`), like ae9f683. |
| Add a **cross-field** rule | Yes, if it runs on drafts | Add it to the **complete** phase only. See owner question 4. |
| Add or tighten a **complete-phase** rule | Not for reading. Yes for drafts already marked complete | They drop back to "drafting" on their next write (owner question 3). |
| Rename a field or a part | Yes | Version 2 + upgrade step. |
| Remove a field | Yes | Version 2 + step moves the value to "kept". |
| Change a field's kind (choice to select, text to number) | Yes | Version 2 + step converts it, or keeps it. |
| Remove or rename an option | Yes | Version 2 + step maps it, or keeps it. |
| Same shape, new meaning (days become months) | Yes, and **silent** | Version 2 + step converts. Only a reviewer can catch this. |

Rule of thumb: **if an old value could fail or mislead, bump the version.**
Until slice 4 ships, bumping is blocked by a test (section 7, test 9).

## 3. The safety net: one read function that never fails

New in `packages/documents/src/read.ts`, used by server and browser:
`readDraft(definition, stored)` returns

- `values`: the answers that fit. **Always** the result of a successful
  check against the draft rules, so it is safe to show, edit and export.
- `kept`: every stored answer that does not fit, with its **path** and a
  reason. Nothing is ever dropped.

Types are in the appendix.

### 3.1 How it reads

1. Not an object: everything goes to `kept`.
2. (Slice 4 only) Run the upgrade step if the stored version is older.
3. Check the whole object. If it passes: done, `kept` is empty. This is the
   normal case.
4. Otherwise, a loop of at most 5 rounds:
   - For each problem, find the **smallest** path to take out:
     - Unknown keys (Zod `unrecognized_keys`, reported at the top level with
       a `keys` list): each key goes to `kept`.
     - A problem inside a field with parts (party, jurisdiction, group) or
       inside a choice's blank: **only that part** goes to `kept`, for
       example `governingLaw.region` or `paymentProcess.value.start`. The
       other parts stay in `values`.
     - A cross-field rule problem names a whole field: that field goes to
       `kept`.
   - Check again. Stop when it passes.
   - After 5 rounds without passing: every field that still has a problem
     goes to `kept` whole, and the check is run one last time. If even that
     fails, `values` is `{}` and everything is kept.

So `values` always passes. A property test proves it (test 2).

### 3.2 Reasons in plain words

Common Zod codes get plain text: wrong kind of value becomes "This answer
has an older format.", an unknown option becomes "This option is no longer
offered.", too long becomes "This answer is too long now.", an unknown key
becomes "This question is no longer in the agreement." Messages from our own
rules ("That's a US state: pick it as the state.") are shown as they are.
Raw Zod messages are never shown to the user.

### 3.3 Writing back

- A **read** (get, chat turn, export, share, preview) never writes.
- A **write** (`updateFields`, `markComplete`, `chooseDocument`) already
  locks the row. It saves the new values **plus every kept part, back at its
  own path**. A kept entry is removed only when the edit targets that exact
  path, or replaces the whole field it sits in (a "whole" field like a
  choice). That is visible: the user or the AI saw the earlier answer
  (section 6) before replacing it.
- The Oregon case after the fix: stored
  `{ governingLaw: { region: "Oregon", courtLocation: "Portland" } }`, and
  `region` fails. `values` has `governingLaw: { courtLocation: "Portland" }`,
  `kept` has `governingLaw.region`. The AI sets `governingLaw.state = "OR"`.
  The merge starts from `{ courtLocation: "Portland" }`, so the saved row is
  `{ state: "OR", courtLocation: "Portland", region: "Oregon" }`. Courts
  survive; the region stays kept until it is cleared or discarded.
- In the browser, `use-save-field.ts`, `use-undo.ts` and
  `use-document-sync.ts` put the kept parts back into the cached
  `fields` after an edit, so the next render still knows them.
- In slices 1 to 3 the version stays 1, so kept values stay in place inside
  `fields`. Same version means same meaning, so this is safe.

### 3.4 Showing old chat messages

`shown` in `message-parts.tsx` formats `change.after` with today's field.
It first checks the value against today's field. If it does not pass, it
shows "changed" instead of crashing.

### 3.5 Logs

- On read: `draft_read_kept` at **info**, with `documentId`, version, count
  and paths. Never the values (user data). Browser reads do not log.
- On write: `draft_kept_saved` at **warn**, only when the set of kept paths
  changes. That happens once per stale draft, not once per chat turn.
- Discard (slice 3): `draft_kept_discarded`, path only.

## 4. Upgrade steps (slice 4, built with the first real version 2)

No document needs version 2 today. So the step code is built **in the same
change as the first real version 2**, against a real case. Until then only
the rules below and the guards in section 7 exist.

Each definition gets one function:
`upgrade(stored, fromVersion) => { values, kept }`. It must not throw, does
no I/O, and touches every key it changes. A value it cannot convert goes to
`kept` with a reason. If it throws anyway, `readDraft` catches it, logs
`draft_upgrade_failed` (error), and reads the old values with the safety
net. A read never writes over the stored draft.

Helpers shipped with it: `choiceToSelect(path)` and `mapOption(path, map)`.

### 4.1 Worked example: the real choice to select change

If 2026-09-24 had happened after launch, the DPA and Pilot would go to
version 2 with:

```ts
upgrade: (stored, from) =>
  from < 2
    ? applySteps(stored, [
        choiceToSelect("governingMemberState"),   // { option: "ie" } -> "ie"
        choiceToSelect("ukTransfers"),
        choiceToSelect("customerRole"),
        // nested inside another choice's blanks:
        choiceToSelect("paymentProcess.value.start"),
        choiceToSelect("paymentProcess.value.cadence"),
      ])
    : { values: stored, kept: [] },
```

`choiceToSelect` turns `{ option: "x" }` into `"x"`, leaves a value that is
already a plain string alone, and keeps anything else (with the path, as in
section 3.1). The nested blanks are why `kept` works on paths, not on fields.

### 4.2 When it runs

| Option | Verdict |
|---|---|
| **On read, in memory** | **Yes.** Pure and cheap. Right whatever the deploy timing. |
| **Saved on the next write** | **Yes.** Inside the existing row lock. |
| One-off job over all drafts | Not now. It would call the same `readDraft`. |

A newer draft read by older code (rollback): if the stored version is higher
than the definition's, `readDraft` returns what it can, and **writes refuse**
with "Parley was updated. Reload the page."

## 5. Where the version is stored (slice 4)

Two new columns, `fields_version smallint` and `kept_fields jsonb`
(recommended; owner question 1). The rules that keep upgrades from running
twice:

- **No database default for new rows.** The DB migration fills old rows with
  1, then every insert must set the version. (Or: nullable, where empty
  means "before versions". Either way, a forgotten insert cannot be stamped
  1 silently.)
- **Every write sets the version and the answers together:**
  - `createDraft` and `updateDraft` write `fields_version = definition.version`.
  - `duplicateDraft` copies `fields`, `fields_version` and `kept_fields`.
  - `chooseDocument` first reads with the **old** definition (`readDraft`),
    then runs `switchDocument`, then stamps the **new** definition's version.
- A test inserts through each path and checks the stamp (test 8).

## 6. What the user and the AI see

Slice 1 has the minimal version; slice 3 adds the buttons.

| Who | Slice 1 | Slice 3 |
|---|---|---|
| Editor, under a field | Read-only line: "Earlier answer: *Oregon*. It no longer fits: That's a US state." | Adds **Use as a starting point** and **Discard**. |
| Editor, removed questions | One line above the document: "Some older answers are kept." | A list with Copy and Discard. |
| AI (system prompt) | One line per kept value: "Kept, not in the document: governingLaw.region = 'Oregon' (no longer fits). Ask the user before replacing it." | Plus the upgrade note for the draft's version. |
| AI tools | Unchanged. An old key gets today's refusal ("There is no field …"). | Same. |
| Old Undo buttons | An undo that no longer fits is refused with today's message. Nothing is overwritten. | Same. |
| Share page, export | Fitting values only. Export still asks for missing fields. | Same. |

Discard is the only way a kept value is deleted.

## 7. Tests that prove it

All in Vitest; DB tests on real Postgres (ADR-0004).

| # | Test | Proves | Slice |
|---|---|---|---|
| 1 | A small **test definition** with the Oregon rule on its draft rules. Stored `{ governingLaw: { region: "Oregon", courtLocation: "Portland" } }` | No throw. `kept` = `governingLaw.region` only, with the plain reason; `courtLocation` is in `values`. | 1 |
| 2 | **Property test**, every definition, random input (wrong types, unknown keys, `null`, arrays, strings, broken cross-field rules) | Never throws. `draftSchema.safeParse(values).success` is always true. Every stored path is in `values` or `kept`. | 1 |
| 3 | DB + router, the Oregon row inserted with raw SQL, then `updateFields governingLaw.state = "OR"` | Saved row has `state`, `courtLocation: "Portland"` and the kept `region`. | 1 |
| 4 | DB + router, a stale row, edit **another** field | Edit works; the kept value is still stored. | 1 |
| 5 | **Frozen fixtures** (main guard): real stored-draft examples per definition in `test/__fixtures__/<id>/`, written once and never regenerated. Includes the Oregon case (expected kept list) and normal drafts | Normal fixtures: `kept` is empty and `values` deep-equal the expected values. Catches tightened rules and `.refine`s, which the snapshot cannot see. | 2 |
| 6 | **Shape snapshot** per definition: `z.toJSONSchema(draftSchema)` with titles and descriptions removed (reuse `clean` from `prompt.ts`) | Catches a renamed, removed or retyped field. Label and help edits do not trip it. | 2 |
| 7 | Old chat message with `after: { option: "x" }` on a select field | `shown` prints "changed", no crash. | 1 |
| 8 | DB: create, duplicate, choose document, update | Each one stamps `fields_version` with the right definition's version. | 4 |
| 9 | Every definition has `version === 1` | Blocks a bump before storage exists. Deleted in slice 4. | 2 |
| 10 | After the first version 2: the v1 fixtures upgraded | `values` deep-equal an expected v2 result, `kept` equals an expected list. | 4 |
| 11 | Router: stored version higher than the definition | Read works; write refuses with the reload message. | 4 |
| 12 | Playwright: open a seeded stale draft, with an old-shape chat message | Preview renders, the "Earlier answer" line shows, edits and a chat turn work. | 1 |

## 8. Slices

**Slice 1: the safety net, visible.** Fixes the reported bug.

- [ ] `readDraft` with the loop, path-level kept values and plain reasons
  (section 3). Tests 1, 2.
- [ ] Switch the 5 server call sites. Writes keep kept parts at their paths.
  Tests 3, 4.
- [ ] Switch the browser call sites; put kept parts back into the cache
  after edits, undo and chat sync. Guard `shown`. Test 7.
- [ ] The read-only "Earlier answer" line and the AI prompt line (section 6).
- [ ] Logs (section 3.5). Test 12.

About 14 small files. No API change: the browser runs the same pure function
on the same row.

**Slice 2: guards.** Frozen fixtures, the cleaned snapshot, and the
"version is still 1" test (tests 5, 6, 9). Package tests only.

**Slice 3: the editor buttons** (Use as a starting point, Discard, the
removed-answers list).

**Slice 4: the first real version 2.** Storage (section 5), the `upgrade`
function and helpers (section 4), the newer-draft refusal, tests 8, 10, 11,
all in one change, against a real definition change.

Not covered: a draft whose document type is removed from the registry.
That would be a new work item.

## 9. Owner questions

1. **Storage for the first version 2:** two new columns (one additive DB
   migration, later) or hidden keys inside `fields` (no migration, but old
   code would fail on them after a rollback)? Recommended: columns.
2. **How long kept values live:** until the user discards them or deletes
   the draft, with no expiry? Recommended: yes.
3. **A complete draft that a new rule makes incomplete:** it drops back to
   "drafting" on its next write, and export asks for the missing fields.
   Exports already paid for stay free. OK?
4. **New cross-field rules:** (a) only in the "complete" phase (no code
   change, simple), or (b) add a third phase, "edit", that checks only the
   edited field and never blocks a read? Recommended: (a) now, (b) when a
   rule really needs to block edits.
5. **Slice 1 visibility:** is the read-only "Earlier answer" line enough
   until slice 3, or should Discard ship in slice 1 too? Without the line,
   an old answer would vanish from view and be replaced by the next edit.
   Recommended: the line in slice 1, buttons in slice 3.

## Appendix: types

```ts
/** A stored answer the current document can't use. Never dropped. */
export type KeptValue = {
  path: string      // "governingLaw.region", "paymentProcess.value.start", "modifications"
  value: unknown    // exactly as stored
  reason: string    // plain words (section 3.2)
}

export type ReadDraft<F extends Fields> = {
  values: DraftValues<F>  // always passes draftSchema
  kept: KeptValue[]
}

export function readDraft<F extends Fields>(
  definition: DocumentDefinition<F>,
  stored: { fields: unknown; version?: number | null }
): ReadDraft<F>
```
