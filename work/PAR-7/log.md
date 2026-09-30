### 2026-09-25T07:47:31Z
Created.

### 2026-09-30T17:40:48Z
From the QA-fixes wave (PAR-33 lane): Try again (regenerate) re-sends a user message the server already stored; chat.send appends it to 'stored' again, so the model sees it twice. saveMessages upserts, so the DB has it once. Same fix as this item.
