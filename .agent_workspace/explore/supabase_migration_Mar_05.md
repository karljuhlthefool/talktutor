# Supabase Migration Research & Application

## Summary of Findings

### 1. Supabase CLI Status

- **Installed**: Yes (`/opt/homebrew/bin/supabase`)
- **Version**: 2.75.0

### 2. Project Linking Status

The project was **already linked** to Supabase:
- **Project Ref**: `vshxqpebbylbhaliddef`
- **Project Name**: `language-app`
- **Region**: East US (Ohio)

To check link status: `supabase link status`
To link a new project: `supabase link --project-ref <ref>`

### 3. Migrations Folder Structure

Located at: `/Users/karl/work/language-app/supabase/migrations/`

Contains:
1. `001_initial_schema.sql` - Core tables (user_preferences, sessions, dictionary_entries, user_progress) with RLS policies
2. `002_invite_system.sql` - Invited users whitelist table with RLS

### 4. How to Apply Migrations

**Push migrations to remote database:**
```bash
supabase db push --linked --include-all
```

Flags:
- `--linked` - Push to the linked project (default true)
- `--include-all` - Include all migrations not found on remote history table
- `--yes` - Answer yes to all prompts (non-interactive)

**What happened:**
- `001_initial_schema.sql` was already applied (not shown in push)
- `002_invite_system.sql` was successfully applied

### 5. Service Role Key

The invite script required `SUPABASE_SERVICE_ROLE_KEY` which was missing from `.env.local`.

**To retrieve API keys via CLI:**
```bash
supabase projects api-keys --project-ref <ref> -o json
```

Added to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Invite User Script Execution

**Script location:** `/Users/karl/work/language-app/scripts/invite-user.mjs`

**Usage:**
```bash
node scripts/invite-user.mjs <email> "<name>"
```

**Result for Karl:**
- Email: `karlasgerjuhl@gmail.com`
- Name: `Karl`
- Invite URL: `http://localhost:3000/invite/edV6nmYA25fYg7nVRcRLvWhXxroua1V_Rube2tzdBjw`

## Key Commands Reference

| Task | Command |
|------|---------|
| Check link status | `supabase link status` |
| List projects | `supabase projects list` |
| Get API keys | `supabase projects api-keys --project-ref <ref>` |
| Push migrations | `supabase db push --linked --include-all` |
| Pull remote schema | `supabase db pull --linked` |

## Summary

- Supabase CLI is installed and project is already linked
- Migration `002_invite_system.sql` was successfully pushed to the remote database
- Added `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
- User `karlasgerjuhl@gmail.com` (Karl) was invited with a unique invite token
- Invite URL generated: `http://localhost:3000/invite/edV6nmYA25fYg7nVRcRLvWhXxroua1V_Rube2tzdBjw`
