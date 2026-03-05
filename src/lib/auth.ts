import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";

// Test user for BYPASS_AUTH mode (local development only)
const TEST_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@local.dev",
  app_metadata: {},
  user_metadata: { name: "Test User" },
  created_at: "2024-01-01T00:00:00Z",
  aud: "authenticated",
  role: "authenticated",
  updated_at: "2024-01-01T00:00:00Z",
} as User;

// Check if auth bypass is enabled (development mode only)
function isBypassAuthEnabled(): boolean {
  return (
    process.env.BYPASS_AUTH === "true" &&
    process.env.NODE_ENV === "development"
  );
}

// Server-side client for Server Components
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  );
}

export async function getUser() {
  // Bypass auth for local testing
  if (isBypassAuthEnabled()) {
    return TEST_USER;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Middleware helper - exported for middleware.ts
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response };
}

// Main middleware function
export async function updateSession(request: NextRequest) {
  // Bypass auth for local testing - skip all auth checks
  if (isBypassAuthEnabled()) {
    return NextResponse.next({ request });
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes under /app
  if (request.nextUrl.pathname.startsWith("/app")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
