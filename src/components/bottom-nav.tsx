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

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border md:hidden">
      <div className="max-w-lg mx-auto flex justify-around items-center h-14 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/app' && pathname === '/app/chat');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute -top-[9px] w-5 h-[2px] rounded-full bg-primary" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
