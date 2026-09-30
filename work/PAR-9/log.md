### 2026-09-25T13:00:28Z
Created.

### 2026-09-29T21:46:59Z
Done: saveMessages strips U+0000 from message parts (strings and keys, nested) before insert. Test on real Postgres: failed with 22P05 first, passes now. Merged 02c8b43.

### 2026-09-29T21:46:59Z
phase: backlog -> done

### 2026-09-30T18:08:51Z
Its regression made the Worker test 'a reply that can't be saved' fail (it relied on NUL); the test now uses a lone surrogate (22P02). Unseen until now because CI runs Worker tests only at night.
