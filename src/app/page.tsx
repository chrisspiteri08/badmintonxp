
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Only perform redirection if auth state is not loading
    if (!isLoading) {
      if (user) {
        // If user exists, redirect based on role
        if (user.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/dashboard');
        }
      } else {
        // If no user, redirect to login
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  // Always show a loading indicator while auth is being checked or redirection is happening
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <p className="text-lg font-semibold">Loading BadmintonXP...</p>
      <p className="text-sm text-muted-foreground">Please wait while we set up the court for The Badminton Community Game.</p>
    </div>
  );
}
