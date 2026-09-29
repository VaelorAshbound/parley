### 2026-09-25T13:00:28Z
Created.

### 2026-09-29T21:46:59Z
Done: saveMessages strips U+0000 from message parts (strings and keys, nested) before insert. Test on real Postgres: failed with 22P05 first, passes now. Merged 02c8b43.

### 2026-09-29T21:46:59Z
phase: backlog -> done
