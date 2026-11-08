
"use client";
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, BarChartHorizontalBig, CalendarDays, Edit3, Globe, Mail, Shield, Star, UserCircle2, Users, Link as LinkIcon, Copy, Loader2, Phone, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [referralLink, setReferralLink] = useState("No referral code generated");

  useEffect(() => {
    if (user?.referralCode && typeof window !== 'undefined') {
      setReferralLink(`${window.location.origin}/login?ref=${user.referralCode}`);
    }
  }, [user?.referralCode]);

  if (isLoading || !user) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-xl text-muted-foreground">Loading profile...</p>
        </div>
    );
  }

  const pointsToNextLevel = (user.level + 1) * 250;
  const progressToNextLevel = Math.min(((user.points || 0) % 250) / 2.5, 100);


  const handleCopyReferralLink = () => {
    if (user.referralCode && referralLink !== "No referral code generated") {
      navigator.clipboard.writeText(referralLink)
        .then(() => {
          toast({ title: "Copied!", description: "Referral link copied to clipboard." });
        })
        .catch(err => {
          toast({ title: "Error", description: "Could not copy link.", variant: "destructive" });
        });
    }
  };

  return (
    <div className="space-y-8">
        <Card className="shadow-xl overflow-hidden">
             <CardHeader className="flex flex-col items-center text-center sm:items-start sm:text-left sm:flex-row sm:items-end gap-4 px-6 pt-6 pb-4">
                <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-4 border-background shadow-lg bg-card">
                    <AvatarImage src={user.avatarUrl || `https://placehold.co/150x150.png?text=${user.name?.substring(0,2)}`} alt={user.name} data-ai-hint="profile avatar" />
                    <AvatarFallback className="text-4xl">{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <CardTitle className="text-4xl font-bold text-primary">{user.name}</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">
                        {user.role === 'admin' ? 'Administrator' : `Level ${user.level} Badminton Enthusiast`}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-1">BadmintonXP - The Badminton Community Game</p>
                </div>
                <Button variant="outline" asChild className="border-accent text-accent hover:bg-accent/10">
                  <Link href="/profile/edit">
                    <Edit3 className="mr-2 h-4 w-4"/> Edit Profile
                  </Link>
                </Button>
            </CardHeader>
            <CardContent className="px-6 pt-2 pb-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-secondary-foreground mb-2">Player Info</h3>
                    <div className="flex items-center text-muted-foreground"><Mail className="h-5 w-5 mr-3 text-primary"/> {user.email}</div>
                    <div className="flex items-center text-muted-foreground"><Globe className="h-5 w-5 mr-3 text-primary"/> {user.country || 'N/A'}{user.continent && user.continent !== 'Unknown' ? `, ${user.continent}` : ''}</div>
                    {user.firstName && user.lastName && <div className="flex items-center text-muted-foreground"><UserCircle2 className="h-5 w-5 mr-3 text-primary"/> {user.firstName} {user.lastName}</div>}
                    {user.mobile && <div className="flex items-center text-muted-foreground"><Phone className="h-5 w-5 mr-3 text-primary"/> {user.mobile}</div>}
                    {user.favouritePlayer && <div className="flex items-center text-muted-foreground"><Heart className="h-5 w-5 mr-3 text-primary"/>Fav Player: {user.favouritePlayer}</div>}
                    {user.teamId && <div className="flex items-center text-muted-foreground"><Users className="h-5 w-5 mr-3 text-primary"/> Team ID: {user.teamId} (View Team Page)</div>}
                     {user.role === 'admin' && <div className="flex items-center text-green-600 font-semibold"><Shield className="h-5 w-5 mr-3"/> Administrator Access</div>}
                </div>
                 <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-secondary-foreground mb-2">Stats & Level</h3>
                    <div className="flex items-center text-lg">
                        <Star className="h-6 w-6 mr-2 text-accent"/>
                        <span className="font-bold text-primary">{(user.points || 0).toLocaleString()} XP</span>
                    </div>
                     <div className="flex items-center text-lg">
                        <Award className="h-6 w-6 mr-2 text-accent"/>
                        <span className="font-bold text-primary">Level {user.level || 1}</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm text-muted-foreground mb-1">
                            <span>Progress to Level {(user.level || 1) + 1}</span>
                            <span>{(user.points || 0) % 250} / 250 XP</span>
                        </div>
                        <Progress value={progressToNextLevel} className="h-3" indicatorClassName="bg-gradient-to-r from-accent to-orange-400"/>
                    </div>
                </div>
                <div className="space-y-3 md:col-span-2">
                    <h3 className="text-xl font-semibold text-secondary-foreground mb-2 flex items-center"><LinkIcon className="mr-2 h-5 w-5 text-primary"/>Your Referral Link</h3>
                    {user.referralCode ? (
                        <div className="flex items-stretch gap-2">
                            <Input type="text" readOnly value={referralLink} className="flex-grow bg-muted/30 border-primary/30" />
                            <Button onClick={handleCopyReferralLink} variant="outline" className="border-accent text-accent hover:bg-accent/10 shrink-0">
                                <Copy className="mr-2 h-4 w-4"/> Copy
                            </Button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Referral code not available.</p>
                    )}
                    <p className="text-xs text-muted-foreground">Share this link with friends. When they sign up using your link, you both may earn bonus XP (if applicable)!</p>
                </div>
            </CardContent>
        </Card>

        {/* Other cards like Achievements and Recent Activity can remain similar, fetching data if needed */}
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-primary flex items-center"><BarChartHorizontalBig className="mr-3 h-7 w-7 text-accent"/>Achievements</CardTitle>
                <CardDescription>Milestones you've reached on your journey.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Placeholder achievements */}
                {['First Win', 'Quiz Master', 'Team Player'].map(ach => (
                    <div key={ach} className="flex flex-col items-center p-4 bg-background rounded-lg shadow text-center border border-border">
                        <Award className="h-10 w-10 text-yellow-500 mb-2"/>
                        <p className="font-semibold text-sm text-secondary-foreground">{ach}</p>
                        <p className="text-xs text-muted-foreground">Unlocked</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    </div>
  );
}
