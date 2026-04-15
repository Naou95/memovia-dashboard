# TODOS — MEMOVIA Dashboard

Deferred work captured by `/plan-eng-review` and other skills. Each entry stays here until built, dropped, or superseded. Never delete without a reason in the commit message.

---

## Auth

### [TODO-A1] Password reset flow

**What:** Self-service password reset via `supabase.auth.resetPasswordForEmail()` + a `/reset-password` page (request + confirm).

**Why:** Today, if Emir forgets his password, Naoufel has to log into Supabase dashboard and manually trigger a reset. Low-frequency pain, but 3am-style when it hits.

**Pros:**
- Emir unblocks himself without pinging Naoufel.
- Standard Supabase flow, very well documented.
- Estimated ~30 min CC to implement end-to-end.

**Cons:**
- Adds 2 routes (`/reset-password/request` + `/reset-password/confirm`) and an email template.
- YAGNI for 2-user dashboard in the first months.

**Context:** Intentionally deferred in Module 1 (Auth + Layout). The current design relies on the admin resetting passwords manually via Supabase dashboard. The design doc (`~/.gstack/projects/memovia-dashboard/naoufelbassou-main-design-20260415-162053.md`) lists this under "NOT in scope."

**Depends on / blocked by:** None. Can be added in any later module.

**Source:** /plan-eng-review on 2026-04-15, Module 1.

---

### [TODO-A2] Admin user management UI

**What:** A page at `/admin/users` (admin_full only) listing `dashboard_profiles` rows with INSERT / UPDATE / DELETE capabilities, backed by a Supabase Edge Function that uses `service_role` to bypass RLS for writes.

**Why:** Every new admin requires Naoufel to run raw SQL. When Emir joins, when we add a third admin, when someone leaves. Onboarding friction at exactly the wrong moment.

**Pros:**
- Onboarding drops from minutes-with-SQL to seconds-with-a-form.
- No tribal knowledge about which tables and fields to update.
- Consolidates admin creation into a discoverable, auditable UI.

**Cons:**
- Needs a new Edge Function (`admin-create-profile`) holding `service_role` key. New blast radius.
- Must enforce admin_full role at the Edge Function boundary (not just RLS, since service_role bypasses RLS).
- ~1 hour CC to build responsibly (validation, audit log entry, confirmation modal for deletes).

**Context:** Module 1 deliberately keeps `dashboard_profiles` INSERT blocked by RLS. The design assumes admins are created via SQL migrations or Supabase dashboard. This TODO lives naturally alongside Module 9 (Utilisateurs MEMOVIA) and may share UI primitives with it.

**Depends on / blocked by:** Module 9 (Utilisateurs MEMOVIA) lands the user-list table pattern first; this TODO should probably ride on that work.

**Source:** /plan-eng-review on 2026-04-15, Module 1.

---
