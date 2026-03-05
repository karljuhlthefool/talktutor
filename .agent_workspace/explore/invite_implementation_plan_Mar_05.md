# Invite System Implementation Plan

## Overview

This plan details how to implement a user invite system that:
1. Creates proper Supabase user accounts (not just sessions)
2. Adds invited users to a dynamic whitelist (database-backed, not hardcoded)
3. Stores user name during invite flow
4. Works seamlessly with the existing magic link auth setup

---

## Current State Analysis

### Existing Auth Flow
- **Login Page**: `src/app/login/page.tsx`
  - Uses hardcoded `ALLOWED_EMAILS` array for whitelist
  - Calls `supabase.auth.signInWithOtp()` for magic link
- **Auth Callback**: `src/app/auth/callback/route.ts`
  - Exchanges code for session via `exchangeCodeForSession()`
- **Middleware**: `src/middleware.ts` + `src/lib/auth.ts`
  - Protects `/app/*` routes
  - Has `BYPASS_AUTH` mode for local development

### Existing Supabase Client Setup
- **Browser client**: `src/lib/auth-client.ts` (anon key, client-side)
- **Server client**: `src/lib/auth.ts` (SSR, server components)
- **Admin client**: `src/lib/supabase-client.ts` (has `supabaseAdmin` proxy using service role key fallback)

### Database Schema
- Located at `supabase/migrations/001_initial_schema.sql`
- Has RLS enabled on all tables
- References `auth.users` for user_id foreign keys

---

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 New Table: `invited_users`

Create a migration file `supabase/migrations/002_invite_system.sql`:

```sql
-- Invited users whitelist
CREATE TABLE IF NOT EXISTS invited_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  invite_token TEXT UNIQUE,           -- For invite link flow
  invited_by UUID,                    -- Future: who invited them (nullable for now)
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,            -- When they first logged in
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_invited_users_email ON invited_users(email);
CREATE INDEX IF NOT EXISTS idx_invited_users_token ON invited_users(invite_token);

-- RLS: Only service role can manage invited_users (admin-only operation)
ALTER TABLE invited_users ENABLE ROW LEVEL SECURITY;

-- No policies needed - all access via service role (admin API routes)
-- This ensures only server-side code with service role can read/write
```

#### 1.2 Update `.env.example`

```bash
# Add service role key (required for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

### Phase 2: Server-Side Admin Operations

#### 2.1 Create `src/lib/invite-operations.ts`

```typescript
'use server';

import { supabaseAdmin } from './supabase-client';
import { randomBytes } from 'crypto';

export interface InvitedUser {
  id: string;
  email: string;
  name: string;
  inviteToken: string | null;
  invitedBy: string | null;
  invitedAt: Date;
  acceptedAt: Date | null;
}

function rowToInvitedUser(row: Record<string, unknown>): InvitedUser {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    inviteToken: row.invite_token as string | null,
    invitedBy: row.invited_by as string | null,
    invitedAt: new Date(row.invited_at as string),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : null,
  };
}

/**
 * Generate a secure random invite token
 */
function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Check if an email is on the whitelist
 */
export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { data, error } = await supabaseAdmin
    .from('invited_users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('Error checking whitelist:', error);
    return false;
  }

  return !!data;
}

/**
 * Add a new invited user to the whitelist
 * Returns the invite token that can be used to create an invite link
 */
export async function inviteUser(
  email: string,
  name: string,
  invitedBy?: string
): Promise<{ success: boolean; inviteToken?: string; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if already invited
  const { data: existing } = await supabaseAdmin
    .from('invited_users')
    .select('id, accepted_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    // Already invited - return existing token if not yet accepted
    if (!existing.accepted_at) {
      const { data } = await supabaseAdmin
        .from('invited_users')
        .select('invite_token')
        .eq('id', existing.id)
        .single();
      return { success: true, inviteToken: data?.invite_token };
    }
    return { success: true }; // Already accepted, no token needed
  }

  // Create new invite
  const inviteToken = generateInviteToken();
  
  const { error } = await supabaseAdmin
    .from('invited_users')
    .insert({
      email: normalizedEmail,
      name,
      invite_token: inviteToken,
      invited_by: invitedBy || null,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, inviteToken };
}

/**
 * Get invited user by token (for invite link flow)
 */
export async function getInvitedUserByToken(token: string): Promise<InvitedUser | null> {
  const { data, error } = await supabaseAdmin
    .from('invited_users')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return rowToInvitedUser(data);
}

/**
 * Mark invited user as accepted (after first login)
 */
export async function markInviteAccepted(email: string): Promise<void> {
  await supabaseAdmin
    .from('invited_users')
    .update({ 
      accepted_at: new Date().toISOString(),
      invite_token: null, // Clear token after use
    })
    .eq('email', email.toLowerCase().trim());
}

/**
 * Get all invited users (for admin UI)
 */
export async function getAllInvitedUsers(): Promise<InvitedUser[]> {
  const { data, error } = await supabaseAdmin
    .from('invited_users')
    .select('*')
    .order('invited_at', { ascending: false });

  if (error) {
    console.error('Error fetching invited users:', error);
    return [];
  }

  return (data || []).map(rowToInvitedUser);
}

/**
 * Remove user from whitelist
 */
export async function removeInvitedUser(email: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('invited_users')
    .delete()
    .eq('email', email.toLowerCase().trim());

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
```

---

### Phase 3: API Routes

#### 3.1 Check Whitelist API Route

Create `src/app/api/auth/check-whitelist/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { isEmailWhitelisted } from '@/lib/invite-operations';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const isWhitelisted = await isEmailWhitelisted(email);
    
    return NextResponse.json({ isWhitelisted });
  } catch (error) {
    console.error('Error checking whitelist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 3.2 Admin Invite API Route

Create `src/app/api/admin/invite/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { inviteUser } from '@/lib/invite-operations';
import { getUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated (optional: add admin role check)
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { email, name } = await request.json();
    
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    const result = await inviteUser(email, name, user.id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Generate invite link
    const inviteUrl = result.inviteToken
      ? `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/invite/${result.inviteToken}`
      : null;

    return NextResponse.json({ 
      success: true, 
      inviteUrl,
      message: inviteUrl 
        ? 'User invited successfully'
        : 'User already accepted, can log in directly'
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 4: Update Login Flow

#### 4.1 Update `src/app/login/page.tsx`

Replace the hardcoded whitelist check with API call:

```typescript
"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// REMOVE: const ALLOWED_EMAILS = ["karlasgerjuhl@gmail.com"];

function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    // Check email whitelist via API
    try {
      const checkResponse = await fetch('/api/auth/check-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const { isWhitelisted } = await checkResponse.json();
      
      if (!isWhitelisted) {
        setStatus("error");
        setError("This app is in private beta. Contact the developer for access.");
        return;
      }
    } catch (err) {
      console.error('Whitelist check failed:', err);
      // Fail open or closed based on security preference
      setStatus("error");
      setError("Unable to verify access. Please try again.");
      return;
    }

    // Proceed with magic link
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  };

  // ... rest of component unchanged
}
```

---

### Phase 5: Invite Link Flow (Optional Enhancement)

#### 5.1 Create Invite Acceptance Page

Create `src/app/invite/[token]/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation';
import { getInvitedUserByToken } from '@/lib/invite-operations';
import { InviteAcceptForm } from './invite-accept-form';

interface Props {
  params: { token: string };
}

export default async function InvitePage({ params }: Props) {
  const invitedUser = await getInvitedUserByToken(params.token);
  
  if (!invitedUser) {
    notFound();
  }

  // If already accepted, redirect to login
  if (invitedUser.acceptedAt) {
    redirect('/login?message=already_accepted');
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          You're Invited!
        </h1>
        <p className="text-muted-foreground mb-6 text-center">
          {invitedUser.name}, click below to accept your invitation and start practicing.
        </p>
        <InviteAcceptForm email={invitedUser.email} name={invitedUser.name} />
      </div>
    </div>
  );
}
```

#### 5.2 Create Invite Accept Form Component

Create `src/app/invite/[token]/invite-accept-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

interface Props {
  email: string;
  name: string;
}

export function InviteAcceptForm({ email, name }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  const handleAccept = async () => {
    setStatus("loading");
    
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?invited=true`,
        data: {
          name, // Pre-fill name in user metadata
        },
      },
    });
    
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">
          Check your email at <span className="font-medium text-foreground">{email}</span> for a magic link.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Email: <span className="text-foreground">{email}</span>
      </p>
      <Button
        onClick={handleAccept}
        disabled={status === "loading"}
        className="w-full h-12 rounded-xl"
      >
        {status === "loading" ? "Sending..." : "Accept Invitation"}
      </Button>
    </div>
  );
}
```

---

### Phase 6: Update Auth Callback

Update `src/app/auth/callback/route.ts` to mark invite as accepted:

```typescript
import { createClient } from "@/lib/auth";
import { markInviteAccepted } from "@/lib/invite-operations";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/chat";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Mark invite as accepted if this is a new user
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await markInviteAccepted(user.email);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
```

---

### Phase 7: Admin Script for Generating Invites

Create `scripts/invite-user.ts`:

```typescript
/**
 * Script to invite a new user
 * Run with: npx tsx scripts/invite-user.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

async function inviteUser(email: string, name: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const inviteToken = generateToken();
  
  // Check if already exists
  const { data: existing } = await supabase
    .from('invited_users')
    .select('id, accepted_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    if (existing.accepted_at) {
      console.log(`✓ ${email} already accepted invite`);
    } else {
      console.log(`✓ ${email} already invited (pending acceptance)`);
    }
    return;
  }

  // Create invite
  const { error } = await supabase
    .from('invited_users')
    .insert({
      email: normalizedEmail,
      name,
      invite_token: inviteToken,
    });

  if (error) {
    console.error(`✗ Failed to invite ${email}:`, error.message);
    return;
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/invite/${inviteToken}`;
  
  console.log(`✓ Invited ${email} (${name})`);
  console.log(`  Invite URL: ${inviteUrl}`);
}

// CLI usage
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx tsx scripts/invite-user.ts <email> <name>');
  console.log('Example: npx tsx scripts/invite-user.ts user@example.com "John Doe"');
  process.exit(1);
}

const [email, name] = args;
inviteUser(email, name);
```

---

## Migration Path

### Step 1: Run Database Migration
```bash
# Apply the new schema in Supabase SQL Editor or via CLI
# Copy contents of supabase/migrations/002_invite_system.sql
```

### Step 2: Migrate Existing Hardcoded Emails
```bash
# Run a one-time migration script to add existing allowed emails
npx tsx scripts/invite-user.ts karlasgerjuhl@gmail.com "Karl"
```

### Step 3: Add Environment Variable
```bash
# Add to .env.local
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Step 4: Deploy Code Changes
1. Create `src/lib/invite-operations.ts`
2. Create API routes under `src/app/api/`
3. Update `src/app/login/page.tsx`
4. Update `src/app/auth/callback/route.ts`
5. Optionally add invite link pages

### Step 5: Test Flow
1. Invite a new email via script or API
2. Try logging in with that email - should work
3. Try logging in with non-whitelisted email - should fail
4. Check database for `accepted_at` timestamp after first login

---

## Security Considerations

1. **Service Role Key**: Never expose in client-side code. Only use in server components and API routes.
2. **RLS Policies**: The `invited_users` table has RLS enabled with no public policies - only service role can access.
3. **Token Expiry**: Consider adding `expires_at` column to invite tokens if time-limited invites are needed.
4. **Rate Limiting**: Consider rate limiting the `/api/auth/check-whitelist` endpoint to prevent enumeration.

---

## Future Enhancements

1. **Admin Dashboard**: Build a simple UI at `/admin/invites` to manage invites
2. **Invite Expiry**: Add token expiration (e.g., 7 days)
3. **Bulk Invites**: CSV upload for inviting multiple users
4. **Email Sending**: Integrate with Resend/SendGrid to send branded invite emails
5. **Referral System**: Track who invited whom using `invited_by` field

---

## Summary

This implementation plan provides a complete invite system that:

1. **Replaces hardcoded whitelist** with a database-backed `invited_users` table
2. **Uses Supabase Admin API** via service role key for secure server-side operations
3. **Maintains magic link auth flow** - users still use `signInWithOtp()` but only whitelisted emails work
4. **Supports invite links** - optional `/invite/[token]` flow for personalized onboarding
5. **Stores user name** during invite for better UX
6. **Tracks acceptance** - marks when users first log in via `accepted_at` timestamp

Key files to create/modify:
- **New**: `supabase/migrations/002_invite_system.sql`
- **New**: `src/lib/invite-operations.ts`
- **New**: `src/app/api/auth/check-whitelist/route.ts`
- **New**: `src/app/api/admin/invite/route.ts`
- **New**: `scripts/invite-user.ts`
- **Modify**: `src/app/login/page.tsx`
- **Modify**: `src/app/auth/callback/route.ts`
- **Optional**: `src/app/invite/[token]/` pages
