
"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import type { Challenge, QuizQuestion } from '@/types';
import { CheckCircle, XCircle, Award, ChevronLeft, Sparkles, Star, Timer } from 'lucide-react';
// DUMMY_CHALLENGES import removed
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

const LOCAL_STORAGE_CHALLENGES_KEY = 'adminChallenges';
const TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY = 'tournamentUserChallengeCompletions';
const QUIZ_TIMER_SECONDS = 15;

interface TournamentCompletions {
  [tournamentId: string]: {
    [userId: string]: string[];
  };
}

// Basic Loader, can be improved or replaced with lucide-react Loader2 if preferred
const Loader2 = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
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

export default function QuizChallengePage() {
  const params = useParams();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const { toast } = useToast();
  const { user: currentUser, updateUserPoints } = useAuth();
  const challengeId = params.challengeId as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [tournamentContext, setTournamentContext] = useState<string | null>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIMER_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        foundChallenge = allChallenges.find(c => c.id === challengeId && c.type === 'quiz');
      } catch (e) {
        console.error("Failed to parse challenges from localStorage for quiz page", e);
      }
    }

    if (foundChallenge) {
      setChallenge(foundChallenge);
    } else {
      toast({ title: "Quiz not found", description: "This quiz could not be loaded or does not exist.", variant: "destructive" });
      router.replace('/challenges');
    }
  }, [challengeId, router, toast, isMounted]);

  const currentQuestion = useMemo(() => {
    return challenge?.questions?.[currentQuestionIndex];
  }, [challenge, currentQuestionIndex]);

  const progressPercentage = challenge?.questions ? ((currentQuestionIndex + 1 ) / challenge.questions.length) * 100 : 0;
  const timerProgress = (timeLeft / QUIZ_TIMER_SECONDS) * 100;

  
  const proceedToNextStep = useCallback(() => {
     setTimeout(() => {
        setShowFeedback(false);
        setSelectedAnswerId(null);
        if (timerRef.current) clearInterval(timerRef.current);

        if (currentQuestionIndex < (challenge?.questions?.length || 0) - 1) {
            setCurrentQuestionIndex(prevIndex => prevIndex + 1);
        } else {
            setQuizCompleted(true);
            if (currentUser) {
                updateUserPoints(score); // Update global user points at the end
            }

            const storedChallenges = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
            if (storedChallenges && challenge) {
                try {
                    let allChallengesFromStorage: Challenge[] = JSON.parse(storedChallenges);
                    allChallengesFromStorage = allChallengesFromStorage.map(c => c.id === challenge.id ? { ...c, status: 'completed' } : c);
                    localStorage.setItem(LOCAL_STORAGE_CHALLENGES_KEY, JSON.stringify(allChallengesFromStorage));
                } catch (e) { console.error("Failed to update challenge status globally", e); }
            }

            if (tournamentContext && challenge?.id && currentUser?.id) {
                const storedTournamentCompletions = localStorage.getItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY);
                let tournamentCompletions: TournamentCompletions = {};
                if (storedTournamentCompletions) {
                    try { tournamentCompletions = JSON.parse(storedTournamentCompletions); } catch (e) { console.error("Failed to parse tournament completions", e); }
                }
                if (!tournamentCompletions[tournamentContext]) tournamentCompletions[tournamentContext] = {};
                if (!tournamentCompletions[tournamentContext][currentUser.id]) tournamentCompletions[tournamentContext][currentUser.id] = [];
                if (!tournamentCompletions[tournamentContext][currentUser.id].includes(challenge.id)) {
                    tournamentCompletions[tournamentContext][currentUser.id].push(challenge.id);
                }
                localStorage.setItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY, JSON.stringify(tournamentCompletions));
            }
        }
    }, 2000);
  }, [challenge, currentQuestionIndex, score, updateUserPoints, tournamentContext, currentUser]);


  const handleTimeOut = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    toast({
        title: "Time's Up!",
        description: "You ran out of time for this question.",
        variant: "destructive",
        duration: 2000,
    });
    setIsCorrect(false);
    setShowFeedback(true);
    proceedToNextStep();
  }, [toast, proceedToNextStep]);


  // Timer effect
  useEffect(() => {
    if (quizCompleted || showFeedback || !currentQuestion) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (timeLeft === 0) {
      handleTimeOut();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prevTime => prevTime - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, quizCompleted, showFeedback, currentQuestion, handleTimeOut]);

  // Effect to reset timer for new questions
  useEffect(() => {
    if (!quizCompleted && !showFeedback) {
      setTimeLeft(QUIZ_TIMER_SECONDS);
    }
  }, [currentQuestionIndex, quizCompleted, showFeedback]);
  
  const handleSubmitAnswer = () => {
    if (!currentQuestion || selectedAnswerId === null || !challenge || !currentUser) {
      toast({ title: "No answer selected", description: "Please select an answer before submitting.", variant: "destructive" });
      return;
    }

    if(timerRef.current) clearInterval(timerRef.current);

    const timeTaken = QUIZ_TIMER_SECONDS - timeLeft;
    const basePoints = currentQuestion.isBonus ? currentQuestion.points * 2 : currentQuestion.points;
    
    let pointsMultiplier = 0;
    if (timeTaken <= 3) pointsMultiplier = 1;      // 100%
    else if (timeTaken <= 7) pointsMultiplier = 0.8; // 80%
    else if (timeTaken <= 12) pointsMultiplier = 0.6; // 60%
    else pointsMultiplier = 0.4;                     // 40%

    const earnedPoints = Math.round(basePoints * pointsMultiplier);
    
    const correct = selectedAnswerId === currentQuestion.correctOptionId;
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      setScore(prevScore => prevScore + earnedPoints);
      toast({
        title: "Correct!",
        description: `You earned ${earnedPoints} XP!`,
        variant: "default",
        duration: 2000,
      });
    } else {
      toast({
        title: "Incorrect",
        description: "Better luck on the next one!",
        variant: "destructive",
        duration: 2000,
      });
    }

    proceedToNextStep();
  };


  if (!isMounted || !challenge || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading quiz greatness...</p>
      </div>
    );
  }

  if (quizCompleted) {
    const totalPossiblePoints = challenge.pointsValue;
    const backLink = tournamentContext
        ? `/tournaments/${tournamentContext}?challengeCompletedInTournament=${challenge.id}`
        : `/challenges?completed_challenge_id=${challenge.id}&type=quiz`;

    return (
      <Card className="shadow-2xl max-w-lg mx-auto text-center bg-card/90 backdrop-blur-sm border-2 border-accent">
        <CardHeader>
          <Award className="h-28 w-28 text-accent mx-auto mb-4 animate-bounce" />
          <CardTitle className="text-4xl font-bold text-primary">Quiz Mastered!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            You've conquered the "{challenge.title}" quiz!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            {score} <span className="text-4xl opacity-80">XP</span>
          </p>
          <p className="text-muted-foreground text-base">
            You scored {score} out of a possible {totalPossiblePoints} points. Well done!
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button asChild className="w-full btn-game-accent text-lg py-3">
            <Link href={backLink}>
              {tournamentContext ? "Back to Tournament" : "Back to Challenges"}
            </Link>
          </Button>
        </CardFooter>
      </Card>
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
                <Star className="h-4 w-4 mr-1.5 fill-current"/> Score: {score} XP
            </Badge>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold text-primary">{challenge.title}</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            Question {currentQuestionIndex + 1} of {challenge.questions.length}
            {currentQuestion.isBonus && <Badge variant="destructive" className="ml-2 animate-pulse py-0.5 px-2 text-xs">BONUS!</Badge>}
          </CardDescription>
          <Progress value={progressPercentage} className="w-full h-1.5 mt-3 rounded-full" indicatorClassName="bg-gradient-to-r from-primary to-secondary rounded-full"/>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between items-center text-sm font-medium">
                <div className="flex items-center text-muted-foreground">
                    <Timer className="h-4 w-4 mr-1.5" />
                    <span>Time Left</span>
                </div>
                <span className={cn("font-bold", timeLeft <= 5 ? "text-destructive animate-pulse" : "text-foreground")}>{timeLeft}s</span>
            </div>
            <Progress value={timerProgress} className="h-2" indicatorClassName={cn("transition-all duration-1000 ease-linear rounded-full", timeLeft <= 5 ? "bg-destructive" : "bg-gradient-to-r from-accent to-yellow-400")}/>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">{currentQuestion.questionText}</h2>

          {currentQuestion.imageUrl && (
            <div className="rounded-lg shadow-md overflow-hidden border-2 border-border">
                <Image
                    src={currentQuestion.imageUrl}
                    alt="Question image"
                    width={600} height={400}
                    className="object-contain max-h-80 w-full bg-muted/30"
                    data-ai-hint="quiz question image"
                />
            </div>
          )}

          {currentQuestion.youtubeVideoId && (
            <div className="aspect-video rounded-lg overflow-hidden shadow-md border-2 border-border">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${currentQuestion.youtubeVideoId}`}
                title="YouTube video player for quiz question"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="rounded-md"
              ></iframe>
            </div>
          )}

          <RadioGroup
            value={selectedAnswerId || ""}
            onValueChange={setSelectedAnswerId}
            className="space-y-3"
            disabled={showFeedback}
          >
            {currentQuestion.options.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ease-in-out cursor-pointer text-base font-medium
                            hover:shadow-lg hover:scale-[1.01]`,
                            showFeedback && option.id === currentQuestion.correctOptionId
                                ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500 !text-green-300 shadow-green-500/30'
                                : '',
                            showFeedback && selectedAnswerId === option.id && option.id !== currentQuestion.correctOptionId
                                ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500 !text-red-400 shadow-red-500/30'
                                : '',
                            !showFeedback && selectedAnswerId === option.id
                                ? 'border-accent bg-accent/10 ring-2 ring-accent text-foreground shadow-accent/30'
                                : 'border-primary/30 bg-background/50 hover:bg-primary/10 hover:border-primary',
                            showFeedback ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                          )}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mr-3 h-5 w-5 data-[state=checked]:border-accent data-[state=checked]:text-accent" />
                <span className="flex-1">{option.text}</span>
                {showFeedback && option.id === currentQuestion.correctOptionId && <CheckCircle className="ml-auto h-6 w-6 text-green-400" />}
                {showFeedback && selectedAnswerId === option.id && option.id !== currentQuestion.correctOptionId && <XCircle className="ml-auto h-6 w-6 text-red-400" />}
              </Label>
            ))}
          </RadioGroup>
        </CardContent>

        <CardFooter className="border-t pt-6 pb-4">
          <Button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswerId === null || showFeedback}
            className="w-full text-lg py-3 btn-game"
          >
            {showFeedback ? (
                <Loader2 className="h-6 w-6 mr-2"/>
            ) : (
                currentQuestionIndex === (challenge.questions.length - 1) ? 'Finish Quiz' : 'Submit & Next Question'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
