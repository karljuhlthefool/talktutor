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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e]/95 backdrop-blur-lg border-t border-white/10">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all',
                isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              <Icon
                className={cn(
                  'transition-all',
                  isActive ? 'w-6 h-6' : 'w-5 h-5'
                )}
              />
              <span className={cn(
                'text-xs font-medium',
                isActive && 'text-white'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
