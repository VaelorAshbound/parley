# ADR-0012: Cost limits in four layers, with a hard cap on the OpenRouter key last

## Status

Accepted (spec approved 2026-09-23; built in T13, T17, T26, T27 and T38)

## Context

Parley is a public demo with a free tier and guests who need no sign-up (ADR-0011). Every chat message is a paid model call, and every PDF is Browser Run time. The spec's cost goals (§8):

- The only fixed cost is the Workers Paid plan ($5/month). Nothing else costs money while idle.
- **The AI spend can't go past the OpenRouter key limit, whatever the traffic.**
- A finished NDA costs under $0.02.

There's no on-call person. A bot, a bug that loops tool calls, or a post that goes viral must not be able to run up a bill.

## Decision

Four layers, each one catching what the one before it lets through:

1. **Per-request size** (`src/server/ai/chat.ts`). A message is one part of at most 4,000 characters. Each model call may write at most 4,096 tokens (`maxOutputTokens`; the evals' largest is under 900), so a prompt that asks for pages of text costs at most about $0.002 a call (added in T40). The model sees at most the last 40 messages or about 48,000 characters of history, so a step stays under ~20k input tokens. A turn may call tools at most 8 times (`stopWhen: isStepCount(8)`). The history comes from the database, so a client can't send a bigger one.
2. **Per-user rate limits** (Workers Rate Limiting bindings, wrangler.jsonc, through oRPC's rate-limit middleware): 10 AI calls per 10 s, 10 downloads a minute, 5 billing calls a minute, 300 calls a minute on any procedure. New guests: 10 per network, then none until an hour after the last one (ADR-0011).
3. **Per-user daily messages** (`ai_usage` in Postgres, one row per user and UTC day): guest 20, Free 100, Pro 500 (`DAILY_MESSAGES`, `src/lib/limits.ts`). Past the limit, chat procedures return the typed `DAILY_LIMIT` error with the reset time, and the UI shows it. Each row also records tokens and cost (`costMicroUsd`, millionths of a dollar), and each refusal logs an `ai_limit` line. Free exports are capped at 3 documents a month (ADR-0006).
4. **A hard credit limit on the OpenRouter key** (set in OpenRouter, no reset): production $10, the test key $5. Previews and CI use the test key, so they can't spend production's. When the key runs out, chat fails with a clear error, and nothing more is charged.

Plus: Turnstile before a guest's first message (ADR-0011), and the Previews' scripted AI (`SCRIPTED_AI`), so the e2e runs never call the paid model.

## Alternatives considered

### A daily cost budget per user (dollars, not messages)

- Pros: Closer to the real cost. The spec first said "daily AI budget".
- Cons: The user can't predict it ("you've used $0.04 today" means nothing to them), and it needs the cost of a reply before it ends. A long questionnaire costs more than a short answer, but at about $0.001 per message the difference is noise.
- Rejected for the limit. The cost is still recorded per user and day, so the limit can move to dollars later without new data.

### Only the OpenRouter cap

- Pros: One setting.
- Cons: One bot spends the whole cap in minutes, and the demo is down for everyone until the owner adds credit.
- Rejected: the cap is the floor, not the plan.

### Spend alerts (5xx, cost per hour)

- Pros: The owner learns about a spike early.
- Cons: Nobody watches a portfolio demo at night. The hard cap already stops the spend.
- Skipped in T38 (owner, 2026-09-30). The `ai_turn` and `ai_limit` lines are in Workers Observability (ADR-0005) for when they're needed.

### Rate limits in Postgres or KV

- Pros: Exact counts, any window.
- Cons: A database write on every call, and KV is eventually consistent.
- Rejected for bursts. The Rate Limiting binding is per location and approximate, which is fine for bursts. The exact daily counts are in Postgres.

## Consequences

- Worst case for one day of abuse: the OpenRouter cap ($10). Normal case: each finished NDA costs $0.0033 (evals, 2026-10-01), so the cap is about 3,000 NDAs.
- When the cap is reached, the demo's chat stops until the owner adds credit. Everything else (drafts, export, share) keeps working.
- The limits are in two places on purpose: wrangler.jsonc for the bindings and `src/server/limits.ts` for tests and messages. A test keeps them equal.
- The load test (`k6`, spec §6) checks that the rate limits and daily limits hold under burst traffic.
