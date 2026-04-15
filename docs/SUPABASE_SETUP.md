# Supabase Manual Configuration Runbook

One-time setup steps that cannot be automated (Supabase dashboard-only actions).
Run these once after applying migrations. Required before the dashboard works end-to-end.

---

## Prerequisites

- Supabase Pro plan active (required for Custom Access Token Hook)
- Access to https://supabase.com/dashboard/project/mzjzwffpqubpruyaaxew

---

## Step 1: Apply Database Migrations

```bash
# Login to Supabase CLI
npx supabase login

# Link this repo to the project
npx supabase link --project-ref mzjzwffpqubpruyaaxew

# Apply migrations (will prompt for DB password)
npx supabase db push
```

**What this creates:**
- `public.dashboard_profiles` table with RLS (SELECT own row only)
- `public.custom_access_token_hook` function (injects `role` into JWT)

---

## Step 2: Register the Custom Access Token Hook

1. Go to: **Supabase Dashboard > Authentication > Hooks**
2. Click **"Add new hook"**
3. Select **"Custom Access Token"** as the hook type
4. Set the function to: `public.custom_access_token_hook`
5. Click **Save**

> Without this step, JWT tokens will not contain the `role` claim.
> The app will still work but RBAC sidebar filtering won't function correctly.

---

## Step 3: Add Redirect URLs (Magic Link)

1. Go to: **Supabase Dashboard > Authentication > URL Configuration**
2. Under **"Redirect URLs"**, add:
   - `http://localhost:5173/`
   - `https://*.vercel.app/`
   - (add your custom domain if applicable)
3. Set **"Site URL"** to your production URL (e.g. `https://dashboard.memovia.io`)

> If this step is skipped, magic link logins will fail with a cryptic redirect_uri error.

---

## Step 4: Create First Admin User (Naoufel)

The dashboard_profiles table is INSERT-locked by RLS. Use the Supabase dashboard or SQL editor:

```sql
-- 1. Create auth user (or use "Invite user" in Auth dashboard)
-- 2. Find the user's UUID from auth.users, then:

INSERT INTO public.dashboard_profiles (id, email, full_name, role)
VALUES (
  '<UUID from auth.users>',
  'naoufel@memovia.io',
  'Naoufel Bassou',
  'admin_full'
);
```

To add Emir (admin_bizdev):
```sql
INSERT INTO public.dashboard_profiles (id, email, full_name, role)
VALUES (
  '<Emir UUID from auth.users>',
  'emir@memovia.io',
  'Emir ...',
  'admin_bizdev'
);
```

---

## Step 5: Configure .env.local

Copy `env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://mzjzwffpqubpruyaaxew.supabase.co
VITE_SUPABASE_ANON_KEY=<from Dashboard > Settings > API > anon/public>
```

---

## Verification Checklist

- [ ] `npx supabase db push` completed without errors
- [ ] Custom Access Token Hook registered in Supabase dashboard
- [ ] Redirect URLs include localhost and Vercel domains
- [ ] At least one row exists in `dashboard_profiles` for your user
- [ ] `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] `npm run dev` → can log in → arrives at `/overview`
- [ ] JWT contains `app_metadata.role` (check in browser DevTools: Application > Local Storage > supabase token, decode at jwt.io)
