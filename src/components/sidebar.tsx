'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic, BookOpen, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/app', label: 'Speak', icon: Mic },
  { href: '/app/dictionary', label: 'Dictionary', icon: BookOpen },
  { href: '/app/progress', label: 'Progress', icon: BarChart3 },
  { href: '/app/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[220px] flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border">
        <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight">TalkTutor</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/app' && pathname === '/app/chat');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-accent text-foreground border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground">TalkTutor v0.1</p>
      </div>
    </aside>
  );
}
