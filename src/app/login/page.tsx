"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  if (status === "sent") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 w-16 h-16 flex items-center justify-center rounded-2xl bg-[var(--success)]/10 border-2 border-[var(--success)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Check your email</h2>
        <p className="text-[15px] text-muted-foreground">
          We sent a magic link to{" "}
          <span className="text-foreground font-medium">{email}</span>
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm text-primary"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      {authError && (
        <div className="w-full rounded-xl px-4 py-3 mb-5 text-center text-sm text-destructive bg-destructive/10 border border-destructive">
          Authentication failed. Please try again.
        </div>
      )}

      <form onSubmit={handleLogin} className="w-full">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          required
          className="mb-4 h-14 text-base rounded-xl bg-muted border-border focus-visible:ring-primary"
        />

        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}

        <Button
          type="submit"
          disabled={status === "loading"}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {status === "loading" ? "Sending…" : "Send Magic Link"}
        </Button>
      </form>
    </>
  );
}

function LoginFallback() {
  return (
    <div className="w-full space-y-4">
      <div className="skeleton rounded-xl h-14" />
      <div className="skeleton rounded-2xl h-14" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="mb-6 w-18 h-18 flex items-center justify-center rounded-2xl bg-primary/10 border-2 border-primary" style={{ width: 72, height: 72 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        </div>

        <h1 className="text-[28px] font-bold text-foreground mb-1 text-center">Language App</h1>
        <p className="text-[15px] text-muted-foreground mb-8 text-center">
          Practice conversations with AI
        </p>

        <Suspense fallback={<LoginFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
