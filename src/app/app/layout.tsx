import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { BottomNav } from '@/components/bottom-nav';
import { Sidebar } from '@/components/sidebar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="pb-20 md:pb-0 md:ml-[220px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
