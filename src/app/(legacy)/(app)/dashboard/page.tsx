
"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, BarChart3, CalendarCheck2, Users, Zap, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";
import type { User } from '@/types';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [globalRank, setGlobalRank] = useState<string | number>("--");
  const [isRankingLoading, setIsRankingLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchRank = async () => {
        const client = supabase;
        if (!client) { setIsRankingLoading(false); return; }

        setIsRankingLoading(true);
        // This is a simplified ranking. For a large number of users, 
        // a dedicated database function or view would be more efficient.
        const { data: allPlayers, error } = await client
          .from('profiles')
          .select('id, points')
          .eq('role', 'player')
          .order('points', { ascending: false });

        if (error) {
          console.error("Error fetching players for ranking:", error);
          setGlobalRank("Error");
        } else if (allPlayers) {
          const currentUserRankIndex = allPlayers.findIndex(p => p.id === user.id);
          if (currentUserRankIndex !== -1) {
            setGlobalRank(`#${currentUserRankIndex + 1}`);
          } else {
            // User might not be in the list if their role isn't 'player' or if points haven't synced
            setGlobalRank(user.role === 'admin' ? "N/A (Admin)" : "N/A");
          }
        }
        setIsRankingLoading(false);
      };
      fetchRank();
    } else {
      setIsRankingLoading(false); // No user, no rank to fetch
    }
  }, [user]);

  if (authIsLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-xl text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const quickActions = [
    { label: "View Leaderboards", href: "/leaderboards", icon: BarChart3, color: "bg-primary/10 text-primary" },
    { label: "My Team", href: user.teamId ? `/teams/${user.teamId}` : "/teams", icon: Users, color: "bg-green-500/10 text-green-600" },
    { label: "Active Challenges", href: "/challenges", icon: Zap, color: "bg-yellow-500/10 text-yellow-600" },
    { label: "Predict Match", href: "/challenges?filter=prediction", icon: CalendarCheck2, color: "bg-purple-500/10 text-purple-600" },
  ];

  return (
    <div className="space-y-8">
      <Card className="shadow-xl border-accent border-2 bg-gradient-to-r from-card to-card/90">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Image src={user.avatarUrl || "https://placehold.co/80x80.png"} alt={user.name || 'User'} width={80} height={80} className="rounded-full border-4 border-accent shadow-md" data-ai-hint="profile avatar" />
            <div>
              <CardTitle className="text-4xl font-bold text-primary">Welcome back, {user.name || 'Player'}!</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">Ready to smash it today?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 p-4 bg-background rounded-lg shadow-md">
            <Award className="h-10 w-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Your Level</p>
              <p className="text-2xl font-bold text-primary">{user.level || 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-background rounded-lg shadow-md">
            <Zap className="h-10 w-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Total Points</p>
              <p className="text-2xl font-bold text-primary">{(user.points || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-background rounded-lg shadow-md">
            <Users className="h-10 w-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Current Rank (Global)</p>
              {isRankingLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <p className="text-2xl font-bold text-primary">{globalRank}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Quick Actions</CardTitle>
          <CardDescription>Jump right into the action.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link href={action.href} key={action.label} legacyBehavior>
              <a className={`flex flex-col items-center justify-center p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 text-center ${action.color.split(' ')[0]} hover:opacity-90`}>
                <action.icon className={`h-12 w-12 mb-2 ${action.color.split(' ')[1]}`} />
                <span className={`font-semibold text-lg ${action.color.split(' ')[1]}`}>{action.label}</span>
              </a>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Placeholder for Recent Activity and Featured Challenge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="text-2xl text-primary">Recent Activity</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Activity feed coming soon...</p></CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="text-2xl text-primary">Featured Challenge</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Image src="https://placehold.co/600x300.png" alt="Featured Challenge" width={600} height={300} className="rounded-lg mb-4 shadow-md" data-ai-hint="badminton action" />
            <h3 className="text-xl font-semibold text-secondary-foreground">Predict the Grand Finals!</h3>
            <p className="text-muted-foreground mb-3">Coming Soon!</p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
              <Link href="/challenges?filter=prediction">Predict Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
