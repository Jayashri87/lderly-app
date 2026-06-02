# Postgres Migration Target

The current production database is Firebase Realtime Database.

This folder contains future Postgres/Supabase migration artifacts for analytics, reporting, and eventual relational scaling. These migrations are not part of the current production runtime.

Recommended migration sequence:

1. Keep Firebase as source of truth.
2. Replicate operational events into Postgres for analytics/reporting.
3. Validate booking, payment, dispatch, and tracking reports against Firebase.
4. Add dual-write only for low-risk append-only tables.
5. Move core booking writes only after rollback and reconciliation tooling exists.

Do not apply these migrations to production without a formal migration runbook.
