
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export const SupabaseConfigErrorDisplay = ({ error }: { error: string }) => (
  <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
    <Card className="max-w-2xl w-full border-2 border-destructive shadow-2xl shadow-destructive/20">
      <CardHeader>
        <div className="flex items-center gap-4">
            <AlertTriangle className="h-12 w-12 text-destructive flex-shrink-0" />
            <div>
                <CardTitle className="text-2xl text-destructive">Application Configuration Error</CardTitle>
                <CardDescription className="text-lg text-foreground/80 mt-1">
                The application cannot connect to the database.
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <div className="p-4 bg-muted rounded-lg space-y-2 border border-border">
            <p className="font-semibold text-foreground">How to fix this:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>In the file explorer, find the <strong><code>.env.local</code></strong> file in the project's root directory.</li>
                <li>Ensure it contains the correct values for <strong><code>NEXT_PUBLIC_SUPABASE_URL</code></strong> and <strong><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></strong> from your Supabase project dashboard.</li>
                <li>
                  <strong>You must restart the server after saving changes.</strong> Use the "Restart Preview" button or stop and start the `npm run dev` command.
                </li>
            </ol>
        </div>
        <p className="text-sm text-muted-foreground italic">
            <strong>Error details:</strong> {error}
        </p>
      </CardContent>
    </Card>
  </div>
);
