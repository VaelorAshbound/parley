CREATE INDEX "rateLimit_lastRequest_idx" ON "rate_limit" USING btree ("last_request");--> statement-breakpoint
CREATE INDEX "session_expiresAt_idx" ON "session" USING btree ("expires_at");