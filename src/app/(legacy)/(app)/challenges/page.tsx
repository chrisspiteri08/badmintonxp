
"use client";
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Puzzle, Users, CalendarCheck2, Zap, Sparkles, AlertTriangle, HelpCircle, UserPlus } from "lucide-react";
import type { Challenge, ChallengeType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
// DUMMY_CHALLENGES import removed
import { useAuth } from '@/contexts/auth-context';
import { subDays, isBefore, parseISO, isValid } from 'date-fns';

const LOCAL_STORAGE_CHALLENGES_KEY = 'adminChallenges'; 

const ChallengeCard = ({ challenge, handleChallengeAction }: { challenge: Challenge; handleChallengeAction: (challenge: Challenge) => void; }) => {
  const getIconForType = (type: ChallengeType) => {
    // Specific icon for referral challenge
    if (challenge.id === 'social-referral') return UserPlus;
    // Default icons based on type
    switch (type) {
      case 'quiz': return Puzzle;
      case 'social': return Users;
      case 'prediction': return CalendarCheck2;
      default: return Zap;
    }
  };
  const Icon = getIconForType(challenge.type);


  const getStatusColorClasses = (status: Challenge['status']) => {
    if (status === 'active') return 'border-accent text-accent';
    if (status === 'completed') return 'border-green-500 text-green-500';
    if (status === 'expired') return 'border-gray-400 text-gray-400';
    return 'border-primary';
  }
  
  const statusColorClasses = getStatusColorClasses(challenge.status);

  return (
    <Card className={`shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col border-l-4 ${statusColorClasses.split(' ')[0]} bg-card/80 backdrop-blur-sm`}>
      {challenge.imageUrl && (
        <Image 
            src={challenge.imageUrl} 
            alt={challenge.title} 
            width={400} 
            height={200} 
            className="w-full h-40 object-cover rounded-t-lg"
            data-ai-hint={challenge.id === 'social-referral' ? "friends referral network" : challenge.type === 'prediction' ? "badminton tournament prediction" : "badminton game"} 
        />
      )}
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className={`p-2 rounded-full bg-opacity-20 ${statusColorClasses.split(' ')[0].replace('border-','bg-')}`}>
            <Icon className={`h-8 w-8 ${statusColorClasses.split(' ')[1]}`} />
        </div>
        <div>
            <CardTitle className="text-xl font-bold text-card-foreground">{challenge.title}</CardTitle>
            <Badge variant={challenge.status === 'active' ? 'accent' : challenge.status === 'completed' ? 'secondary' : 'outline'} 
                   className={`capitalize mt-1 ${challenge.status === 'completed' ? 'bg-green-500/80 text-white' : challenge.status === 'expired' ? 'bg-muted/50 border-muted-foreground/50 text-muted-foreground' : '' }`}>
                {challenge.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground mb-3">{challenge.description}</p>
        <div className="flex items-center text-lg font-semibold text-accent">
          <Sparkles className="h-5 w-5 mr-2" /> {challenge.pointsValue} XP
          {challenge.participationPoints && challenge.participationPoints > 0 && (
             <Badge variant="outline" className="ml-2 text-xs py-0.5 px-1.5 border-muted-foreground/50 text-muted-foreground">+{challenge.participationPoints} for trying</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {challenge.status === 'active' && (
          <Button 
            className="w-full btn-game"
            onClick={() => handleChallengeAction(challenge)}
          >
            {challenge.type === 'quiz' ? <Puzzle className="mr-2 h-5 w-5" /> : 
             challenge.type === 'prediction' ? <CalendarCheck2 className="mr-2 h-5 w-5" /> : 
             challenge.id === 'social-referral' ? <UserPlus className="mr-2 h-5 w-5" /> :
             <HelpCircle className="mr-2 h-5 w-5" />} 
            Take Challenge
          </Button>
        )}
        {challenge.status === 'completed' && (
          <Button variant="outline" disabled className="w-full border-green-500 text-green-500 bg-green-500/10 hover:bg-green-500/20">
            <CheckCircle className="mr-2 h-5 w-5" /> Completed
          </Button>
        )}
        {challenge.status === 'expired' && (
           <Button variant="outline" disabled className="w-full border-muted-foreground/50 text-muted-foreground bg-muted/20 hover:bg-muted/30">
            <AlertTriangle className="mr-2 h-5 w-5" /> Expired
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filter, setFilter] = useState<ChallengeType | "all">("all");
  const { toast } = useToast();
  const { user, updateUserPoints } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedChallenges = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
    if (storedChallenges) {
      try {
        setChallenges(JSON.parse(storedChallenges));
      } catch (e) {
        console.error("Failed to parse challenges from localStorage, falling back to empty array", e);
        setChallenges([]); // Fallback to empty array
      }
    } else {
      setChallenges([]); // Fallback to empty array
    }
  }, []);

  // useEffect to handle completed_challenge_id from query params
  useEffect(() => {
    if (!isMounted) return;

    const completedChallengeId = searchParams.get('completed_challenge_id');
    const challengeTypeFromQuery = searchParams.get('type') as ChallengeType | null;
    
    if (completedChallengeId) {
      setChallenges(prevChallenges =>
        prevChallenges.map(c =>
          c.id === completedChallengeId && (c.type !== 'prediction' || challengeTypeFromQuery === 'quiz') 
            ? { ...c, status: 'completed' } 
            : c
        )
      );
      // Clear the query parameter by navigating to the current path without it
      if (pathname) { // Ensure pathname is available
        router.replace(pathname, { scroll: false }); 
      }
    }
  }, [searchParams, isMounted, router, pathname]);

  // useEffect to award points for correct predictions
  useEffect(() => {
    if (!isMounted || !user || !challenges.length) return;

    challenges.forEach(challenge => {
      if (challenge.type === 'prediction' && challenge.status === 'completed' && challenge.correctPredictionOptionId) {
        const userPredictionKey = `user_prediction_${user.id}_${challenge.id}`;
        const awardedWinKey = `user_prediction_awarded_win_${user.id}_${challenge.id}`;
        
        const userPredictedOptionId = localStorage.getItem(userPredictionKey);
        const alreadyAwardedWin = localStorage.getItem(awardedWinKey);

        if (userPredictedOptionId === challenge.correctPredictionOptionId && !alreadyAwardedWin) {
          updateUserPoints(challenge.pointsValue); 
          toast({
            title: "Prediction Success!",
            description: `Congratulations! You correctly predicted the outcome for "${challenge.title}" and earned ${challenge.pointsValue} XP!`,
            variant: "default",
            duration: 7000,
          });
          localStorage.setItem(awardedWinKey, 'true');
        }
      }
    });
  }, [challenges, user, updateUserPoints, toast, isMounted]);


  const handleChallengeAction = (challenge: Challenge) => {
    if (challenge.status !== 'active' || !user) return;
    
    if (challenge.participationPoints && challenge.participationPoints > 0) {
        const participationAwardKey = `user_participation_awarded_${user.id}_${challenge.id}`;
        if (!localStorage.getItem(participationAwardKey)) {
            updateUserPoints(challenge.participationPoints);
            toast({
                title: "Participation XP!",
                description: `You earned ${challenge.participationPoints} XP just for trying!`,
                variant: "default",
                duration: 2000
            });
            localStorage.setItem(participationAwardKey, 'true');
        }
    }


    if (challenge.type === 'quiz') {
      router.push(`/challenges/${challenge.id}`);
    } else if (challenge.type === 'prediction') {
      // Pass challenge_type to distinguish on the target page if needed, though not strictly necessary for prediction flow now
      router.push(`/challenges/prediction/${challenge.id}?challenge_type=prediction`);
    } else if (challenge.id === 'social-referral') {
      updateUserPoints(challenge.pointsValue); 
      setChallenges(prevChallenges =>
        prevChallenges.map(c =>
          c.id === challenge.id ? { ...c, status: 'completed' } : c
        )
      );
      toast({
        title: "Referral Success!",
        description: `You and your friend earned ${challenge.pointsValue} XP! (Friend's XP is simulated in prototype)`,
        variant: "default"
      });
    } else { 
      updateUserPoints(challenge.pointsValue);
      setChallenges(prevChallenges =>
        prevChallenges.map(c =>
          c.id === challenge.id ? { ...c, status: 'completed' } : c
        )
      );
      toast({
        title: "Challenge Complete!",
        description: `You earned ${challenge.pointsValue} XP!`,
        variant: "default"
      });
    }
  };

  const filteredChallenges = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);

    const processAndFilter = (allChallenges: Challenge[]) => {
      return allChallenges
        .filter(challenge => {
          if (filter !== "all" && challenge.type !== filter) {
            return false;
          }
          if (challenge.status === 'expired' && challenge.expiryDate) {
            const expiry = parseISO(challenge.expiryDate);
            if (isValid(expiry) && isBefore(expiry, sevenDaysAgo)) {
              return false; 
            }
          }
          return true;
        })
        .sort((a, b) => {
          const statusOrder = { active: 1, completed: 2, expired: 3 };
          if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
          }
          if (a.status === 'active' && a.expiryDate && b.expiryDate) {
            const expiryA = parseISO(a.expiryDate);
            const expiryB = parseISO(b.expiryDate);
            if (isValid(expiryA) && isValid(expiryB)) {
                return expiryA.getTime() - expiryB.getTime();
            }
          }
          return a.title.localeCompare(b.title);
        });
    };
    
    return processAndFilter(challenges);

  }, [filter, challenges]);

  if (!isMounted) {
     return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Zap className="h-16 w-16 animate-pulse text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading challenges...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-2xl bg-card/50 border-2 border-primary/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-foreground flex items-center"><Zap className="h-10 w-10 mr-3 text-accent" />Challenges</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">Test your skills, knowledge, and luck to earn XP and climb the ranks!</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as ChallengeType | "all")} className="w-full">
         <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 rounded-lg bg-primary/20 backdrop-blur-sm">
          <TabsTrigger value="all" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold">All Challenges</TabsTrigger>
          <TabsTrigger value="social" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold"><Users className="h-5 w-5 mr-2"/>Social</TabsTrigger>
          <TabsTrigger value="quiz" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold"><Puzzle className="h-5 w-5 mr-2"/>Quiz</TabsTrigger>
          <TabsTrigger value="prediction" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold"><CalendarCheck2 className="h-5 w-5 mr-2"/>Predictions</TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
            {filteredChallenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredChallenges.map(challenge => (
                  <ChallengeCard 
                    key={challenge.id} 
                    challenge={challenge} 
                    handleChallengeAction={handleChallengeAction} 
                  />
                ))}
            </div>
            ) : (
            <Card className="shadow-xl bg-card/80 backdrop-blur-sm">
                <CardContent className="py-12 text-center">
                <Zap className="h-24 w-24 text-accent mx-auto mb-4" />
                <h3 className="text-2xl font-semibold text-primary mb-2">No Challenges Available</h3>
                <p className="text-muted-foreground">
                    There are no challenges of this type available right now. Check back later!
                </p>
                </CardContent>
            </Card>
            )}
        </div>
      </Tabs>
    </div>
  );
}
