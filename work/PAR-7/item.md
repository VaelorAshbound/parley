---
id: PAR-7
title: Make Try again a clean retry for messages and questionnaire answers
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T07:47:31Z
updated: 2026-09-25T07:47:31Z
---

Found in T19. "Try again" after a failed turn calls useChat's regenerate(), which resends the user's message by id. The server already saved it, so its history holds that message twice (and a partial reply may sit between them). After a failed answer turn, regenerate drops the whole assistant message, questions included.

Done when: a retry is a real retry: the server treats a resent message id as a retry (drops what came after it from the model's view, and from storage or marks it), and a failed answer turn retries by resending the answers. Worker tests for both.
