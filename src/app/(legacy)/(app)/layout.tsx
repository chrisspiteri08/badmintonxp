
"use client";
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    if (!isLoading) {
      if (!session || !user) {
        router.replace('/login');
      }
    }
  }, [user, session, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Verifying session...</p>
      </div>
    );
  }

  if (!session || !user) {
     // This state will be brief as the useEffect above will redirect.
     // Showing a loader here prevents a flash of un-styled content or errors.
    return (
       <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Redirecting...</p>
      </div>
    );
  }
  
  // Only render the AppShell and children if we have a valid session and user
  return <AppShell isAdminRoute={false}>{children}</AppShell>;
}
