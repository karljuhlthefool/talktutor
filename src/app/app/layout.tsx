import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { BottomNav } from '@/components/bottom-nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  // If no user, middleware should have redirected to login
  // But this is a safety check
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <main className="pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
