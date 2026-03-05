import { notFound, redirect } from 'next/navigation';
import { getInvitedUserByToken } from '@/lib/invite-operations';
import { InviteAcceptForm } from './invite-accept-form';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const invitedUser = await getInvitedUserByToken(token);

  if (!invitedUser) {
    notFound();
  }

  // If already accepted, redirect to login with message
  if (invitedUser.acceptedAt) {
    redirect('/login?message=already_accepted');
  }

  // If already claimed (user entered their info), redirect to login
  if (invitedUser.claimedAt && invitedUser.email) {
    redirect('/login?message=invite_claimed');
  }

  // Generic invite - show form to collect name/email
  if (invitedUser.isGeneric) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Logo */}
          <div className="mb-8 w-12 h-12 flex items-center justify-center rounded-xl bg-primary/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 8 6 6" />
              <path d="m4 14 6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="m22 22-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-2 text-center tracking-tight">
            You're Invited!
          </h1>
          <p className="text-muted-foreground mb-6 text-center">
            Enter your details to accept your invitation and start practicing.
          </p>

          <InviteAcceptForm token={token} mode="claim" />
        </div>
      </div>
    );
  }

  // Standard invite - email/name already known
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 w-12 h-12 flex items-center justify-center rounded-xl bg-primary/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2 text-center tracking-tight">
          You're Invited!
        </h1>
        <p className="text-muted-foreground mb-6 text-center">
          {invitedUser.name}, click below to accept your invitation and start practicing.
        </p>

        <InviteAcceptForm email={invitedUser.email!} name={invitedUser.name!} mode="accept" />
      </div>
    </div>
  );
}
