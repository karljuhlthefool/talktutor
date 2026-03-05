# Generic Invite Links Implementation

## Overview
Changed the invite system to support generic invite links where:
1. Admin generates a link WITHOUT knowing the recipient's email
2. Anyone with the link can visit it and enter THEIR OWN name + email
3. They get whitelisted and can proceed with magic link

## Files Changed

### 1. Database Migration
**File:** `/Users/karl/work/language-app/supabase/migrations/003_generic_invites.sql`

Changes to `invited_users` table:
- Made `email` and `name` columns nullable (for unclaimed invites)
- Added `is_generic BOOLEAN DEFAULT FALSE` to distinguish generic vs specific invites
- Added `claimed_at TIMESTAMPTZ` to track when a generic invite was claimed
- Created partial unique index on email (only for non-NULL values)

### 2. Invite Operations
**File:** `/Users/karl/work/language-app/src/lib/invite-operations.ts`

Updated `InvitedUser` interface:
- `email` and `name` are now `string | null`
- Added `isGeneric: boolean`
- Added `claimedAt: Date | null`

New/Updated Functions:
- `createGenericInvite(invitedBy?)` - Creates a new generic invite with no email/name
- `claimGenericInvite(token, email, name)` - Claims a generic invite with user's info
- Updated `inviteUser()` to set `is_generic: false` explicitly
- Updated `removeInvitedUser()` to use `id` instead of `email` (since email can be null)

### 3. Invite Page
**File:** `/Users/karl/work/language-app/src/app/invite/[token]/page.tsx`

Flow logic:
1. Check if invite exists and is valid
2. If already accepted -> redirect to login
3. If already claimed -> redirect to login
4. If generic invite (`isGeneric: true`) -> show claim form
5. If standard invite -> show accept form with pre-filled email/name

### 4. Invite Accept Form
**File:** `/Users/karl/work/language-app/src/app/invite/[token]/invite-accept-form.tsx`

Two modes:
- `mode: "claim"` - Shows name/email input fields for generic invites
- `mode: "accept"` - Shows pre-filled email with accept button

Claim flow:
1. Validate form inputs
2. Call `claimGenericInvite()` to save email/name to whitelist
3. Send magic link via `signInWithOtp()`
4. Show success message

### 5. Invite Script
**File:** `/Users/karl/work/language-app/scripts/invite-user.mjs`

New usage:
```bash
# Specific user (existing behavior)
node scripts/invite-user.mjs friend@example.com "John Doe"

# Generic link (NEW)
node scripts/invite-user.mjs --generic
node scripts/invite-user.mjs -g
```

## Database Flow

### Standard Invite (existing)
1. Admin creates: `{email, name, is_generic: false, invite_token: "xxx"}`
2. User visits link -> sees pre-filled name/email
3. User clicks accept -> magic link sent
4. User clicks magic link -> `accepted_at` set

### Generic Invite (new)
1. Admin creates: `{email: null, name: null, is_generic: true, invite_token: "xxx"}`
2. User visits link -> sees empty form
3. User enters name/email -> `claimed_at` set, email/name saved
4. Magic link sent automatically
5. User clicks magic link -> `accepted_at` set

## Summary
- Added database migration to support nullable email/name and new columns (`is_generic`, `claimed_at`)
- Created `createGenericInvite()` and `claimGenericInvite()` functions
- Updated invite page to detect and handle generic vs specific invites
- Updated form component to show input fields for generic invites
- Updated CLI script with `--generic` / `-g` flag to generate generic links
