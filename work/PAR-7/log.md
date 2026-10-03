### 2026-09-25T07:47:31Z
Created.

### 2026-09-30T17:40:48Z
From the QA-fixes wave (PAR-33 lane): Try again (regenerate) re-sends a user message the server already stored; chat.send appends it to 'stored' again, so the model sees it twice. saveMessages upserts, so the DB has it once. Same fix as this item.

### 2026-10-03T07:17:52Z
Wave 1 (branch fix/wave-1): retry fixed and one turn at a time per draft. Owner 2026-10-03: a failed turn plus its retry counts 2 daily messages (fine); the turn record moves from a system row in message to a proper migration (in progress).

### 2026-10-03T07:50:20Z
Turn record moved to its own chat_turn table (migration 0006). Merged to main 5e32521, production migrated (7 migrations), deployed, smoke green.

### 2026-10-03T07:50:20Z
phase: backlog -> done
