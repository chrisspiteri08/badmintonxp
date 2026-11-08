
"use client";
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import type { Challenge, PredictionOption } from '@/types';
import { ChevronLeft, Star, CheckCircle, Loader2 as LoaderIcon } from 'lucide-react';
// DUMMY_CHALLENGES import removed
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

const LOCAL_STORAGE_CHALLENGES_KEY = 'adminChallenges';
const TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY = 'tournamentUserChallengeCompletions';

interface TournamentCompletions {
  [tournamentId: string]: {
    [userId: string]: string[];
  };
}

// Re-using the loader for consistency
const Loader = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function PredictionChallengePage() {
  const params = useParams();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const { toast } = useToast();
  const { user: currentUser, updateUserPoints } = useAuth();
  const challengeId = params.challengeId as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tournamentContext, setTournamentContext] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);


  useEffect(() => {
    setIsMounted(true);
    const context = searchParamsHook.get('tournamentContext');
    if (context) {
      setTournamentContext(context);
    }
  }, [searchParamsHook]);

  useEffect(() => {
    if (!isMounted || !challengeId) return;

    let foundChallenge: Challenge | undefined | null = null;
    const storedChallenges = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
    let allChallenges: Challenge[] = [];

    if (storedChallenges) {
        try {
            allChallenges = JSON.parse(storedChallenges);
            foundChallenge = allChallenges.find(c => c.id === challengeId && c.type === 'prediction');
        } catch (e) {
            console.error("Failed to parse challenges from localStorage for prediction page", e);
            // Fallback to empty if DUMMY_CHALLENGES was used here
        }
    } else {
        // Fallback to empty if DUMMY_CHALLENGES was used here
    }

    if (foundChallenge) {
      setChallenge(foundChallenge);
    } else {
      toast({ title: "Prediction challenge not found", description: "This challenge could not be loaded.", variant: "destructive" });
      router.replace('/challenges');
    }
  }, [challengeId, router, toast, isMounted]);

  const handleSubmitPrediction = () => {
    if (!challenge || !selectedOptionId || !currentUser) {
      toast({ title: "No option selected", description: "Please select an option before submitting.", variant: "destructive" });
      return;
    }
    if(!challenge.predictionOptions) {
        toast({ title: "Error", description: "Prediction options not available for this challenge.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      // Award participation points if defined
      if (challenge.participationPoints && challenge.participationPoints > 0) {
        updateUserPoints(challenge.participationPoints);
        toast({
            title: "Prediction Submitted!",
            description: `You earned ${challenge.participationPoints} XP for participating! Good luck! Results will be announced later.`,
            variant: "default",
        });
      } else {
         toast({
            title: "Prediction Submitted!",
            description: `Good luck! Results will be announced later.`,
            variant: "default",
        });
      }

      // Mark prediction as "attempted" or store user's choice for later resolution by admin
      // For prototype, we'll just store the choice in localStorage.
      // This doesn't give points yet, admin resolution gives points.
      localStorage.setItem(`user_prediction_${currentUser.id}_${challenge.id}`, selectedOptionId);


      // If in tournament context, record completion for the tournament (if participation yields points)
      // Prediction challenge points are typically awarded upon resolution, not submission.
      // However, if participationPoints are considered tournament points, record it.
      if (tournamentContext && challenge.id && currentUser.id && challenge.participationPoints && challenge.participationPoints > 0) {
          const storedTournamentCompletions = localStorage.getItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY);
          let tournamentCompletions: TournamentCompletions = {};
          if (storedTournamentCompletions) {
              try { tournamentCompletions = JSON.parse(storedTournamentCompletions); } catch (e) { console.error("Failed to parse tournament completions", e); }
          }
          if (!tournamentCompletions[tournamentContext]) tournamentCompletions[tournamentContext] = {};
          if (!tournamentCompletions[tournamentContext][currentUser.id]) tournamentCompletions[tournamentContext][currentUser.id] = [];

          // For predictions, we might consider participation itself as completing the "challenge" for tournament points
          // if participation points are awarded. Or, points are only awarded after admin resolves.
          // For now, let's assume if participationPoints exist, it counts towards tournament completion.
          if (!tournamentCompletions[tournamentContext][currentUser.id].includes(challenge.id)) {
              tournamentCompletions[tournamentContext][currentUser.id].push(challenge.id);
          }
          localStorage.setItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY, JSON.stringify(tournamentCompletions));
      }


      setIsSubmitting(false);
      const backLink = tournamentContext
        ? `/tournaments/${tournamentContext}?challengeCompletedInTournament=${challenge.id}` // Or a more specific param like predictionSubmitted
        : `/challenges?completed_challenge_id=${challenge.id}&type=prediction`; // Indicate prediction participation
      router.push(backLink);
    }, 1500);
  };

  if (!isMounted || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader className="h-16 w-16 text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading prediction challenge...</p>
      </div>
    );
  }

  if (!challenge.predictionOptions || challenge.predictionOptions.length === 0) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Card className="shadow-2xl max-w-lg mx-auto text-center bg-card/90 backdrop-blur-sm border-2 border-destructive">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-destructive">Configuration Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground">This prediction challenge is not configured correctly (missing options).</p>
          </CardContent>
          <CardFooter>
             <Button onClick={() => router.push('/challenges')} className="w-full btn-game">Back to Challenges</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <Card className="shadow-xl overflow-hidden bg-card/90 backdrop-blur-sm border border-primary/30">
        <CardHeader className="border-b pb-4 bg-gradient-to-r from-card to-card/80">
          <div className="flex justify-between items-center mb-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Badge variant="accent" className="text-sm px-3 py-1">
                <Star className="h-4 w-4 mr-1.5 fill-current"/>
                {challenge.participationPoints && challenge.participationPoints > 0 ? `${challenge.participationPoints} XP for participation. ` : ''}
                Win: {challenge.pointsValue} XP
            </Badge>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold text-primary">{challenge.title}</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            {challenge.description} Make your choice!
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {challenge.imageUrl && (
            <div className="rounded-lg shadow-md overflow-hidden border-2 border-border">
                <Image
                    src={challenge.imageUrl}
                    alt="Challenge image"
                    width={600} height={300}
                    className="object-cover w-full bg-muted/30"
                    data-ai-hint="prediction challenge event"
                />
            </div>
          )}

          <RadioGroup
            value={selectedOptionId || ""}
            onValueChange={setSelectedOptionId}
            className="space-y-3"
            disabled={isSubmitting}
          >
            {challenge.predictionOptions.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ease-in-out
                            hover:shadow-lg hover:scale-[1.01] text-base font-medium`,
                            selectedOptionId === option.id
                                ? 'border-accent bg-accent/10 ring-2 ring-accent text-foreground shadow-accent/30'
                                : 'border-primary/30 bg-background/50 hover:bg-primary/10 hover:border-primary',
                            isSubmitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                          )}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mr-3 h-5 w-5 data-[state=checked]:border-accent data-[state=checked]:text-accent" />
                <span className="flex-1">{option.text}</span>
                {selectedOptionId === option.id && <CheckCircle className="ml-auto h-6 w-6 text-accent" />}
              </Label>
            ))}
          </RadioGroup>
        </CardContent>

        <CardFooter className="border-t pt-6 pb-4">
          <Button
            onClick={handleSubmitPrediction}
            disabled={selectedOptionId === null || isSubmitting}
            className="w-full text-lg py-3 btn-game"
          >
            {isSubmitting ? (
                <LoaderIcon className="h-6 w-6 mr-2 animate-spin"/>
            ) : (
                'Submit Prediction'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
