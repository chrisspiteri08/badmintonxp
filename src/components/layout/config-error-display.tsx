"use client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
export const SupabaseConfigErrorDisplay = () => (
  <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
    <Card className="max-w-lg w-full">
      <CardHeader>
        <CardTitle>We’ll be back shortly.</CardTitle>
        <CardDescription>
          The arena is taking a break. Please try again soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/demo">Play the guest demo →</Link>
      </CardContent>
    </Card>
  </div>
);
