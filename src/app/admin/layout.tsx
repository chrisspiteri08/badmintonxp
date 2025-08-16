
"use client";
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!session || !user) {
        router.replace('/login');
      } else if (user.role !== 'admin') {
        router.replace('/dashboard'); 
      }
    }
  }, [user, session, isLoading, router]);

  if (isLoading || (!session && !isLoading && pathname !== '/login')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !user || user.role !== 'admin') {
    if (session && user && user.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
                <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
                <p className="text-muted-foreground">You do not have permission to view this admin area.</p>
                <Button onClick={() => router.push('/dashboard')} className="mt-6">Go to Player Dashboard</Button>
            </div>
        );
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-4 text-lg">Verifying admin access...</p>
      </div>
    );
  }

  return <AppShell isAdminRoute={true}>{children}</AppShell>;
}
