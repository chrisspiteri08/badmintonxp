
"use client";
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { Tournament, Challenge, User as UserType, Team as TeamType, LeaderboardItem, ChallengeType } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { ChevronLeft, Swords, CalendarDays, ListChecks, Puzzle, Users, Globe, Trophy, Star, Crown, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, HelpCircle, UserPlus, CheckCircle, Zap, ChevronDown, ChevronUp, CalendarCheck2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const LOCAL_STORAGE_TOURNAMENTS_KEY = 'adminTournaments';
const LOCAL_STORAGE_CHALLENGES_KEY = 'adminChallenges';
const ADMIN_MANAGED_USERS_KEY = 'adminManagedUsers';
const TEAMS_STORAGE_KEY = 'userTeams';
const TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY = 'tournamentUserChallengeCompletions';

interface TournamentCompletions {
  [tournamentId: string]: {
    [userId: string]: string[]; // Array of completed challenge IDs
  };
}

// --- Reused Challenge Card Logic (adapted from challenges/page.tsx) ---
const ChallengeCard = ({ challenge, handleChallengeAction, tournamentId }: { challenge: Challenge; handleChallengeAction: (challenge: Challenge, tournamentId: string) => void; tournamentId: string }) => {
  const getIconForType = (type: ChallengeType) => {
    if (challenge.id === 'social-referral') return UserPlus;
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
    <Card className={`shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col border-l-4 ${statusColorClasses.split(' ')[0]} bg-card/90 backdrop-blur-sm`}>
      {challenge.imageUrl && (
        <Image
            src={challenge.imageUrl}
            alt={challenge.title}
            width={400}
            height={200}
            className="w-full h-32 object-cover rounded-t-lg"
            data-ai-hint={challenge.id === 'social-referral' ? "friends referral network" : challenge.type === 'prediction' ? "badminton tournament prediction" : "badminton game"}
        />
      )}
      <CardHeader className="flex-row items-start gap-3 space-y-0 py-4 px-4">
        <div className={`p-1.5 rounded-full bg-opacity-20 ${statusColorClasses.split(' ')[0].replace('border-','bg-')}`}>
            <Icon className={`h-6 w-6 ${statusColorClasses.split(' ')[1]}`} />
        </div>
        <div>
            <CardTitle className="text-lg font-bold text-card-foreground">{challenge.title}</CardTitle>
            <Badge variant={challenge.status === 'active' ? 'accent' : challenge.status === 'completed' ? 'secondary' : 'outline'}
                   className={`capitalize mt-1 text-xs py-0.5 px-1.5 ${challenge.status === 'completed' ? 'bg-green-500/80 text-white' : challenge.status === 'expired' ? 'bg-muted/50 border-muted-foreground/50 text-muted-foreground' : '' }`}>
                {challenge.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow px-4 py-2">
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{challenge.description}</p>
        <div className="flex items-center text-sm font-semibold text-accent">
          <Star className="h-4 w-4 mr-1.5" /> {challenge.pointsValue} XP
        </div>
      </CardContent>
      <CardFooter className="px-4 py-3">
        {challenge.status === 'active' && ( // Consider also checking if user has completed THIS challenge in THIS tournament
          <Button
            className="w-full btn-game text-sm py-2"
            onClick={() => handleChallengeAction(challenge, tournamentId)}
          >
            {challenge.type === 'quiz' ? <Puzzle className="mr-1.5 h-4 w-4" /> :
             challenge.type === 'prediction' ? <CalendarCheck2 className="mr-1.5 h-4 w-4" /> :
             challenge.id === 'social-referral' ? <UserPlus className="mr-1.5 h-4 w-4" /> :
             <HelpCircle className="mr-1.5 h-4 w-4" />}
            Take Challenge
          </Button>
        )}
        {challenge.status === 'completed' && (
          <Button variant="outline" disabled className="w-full border-green-500 text-green-500 bg-green-500/10 hover:bg-green-500/20 text-sm py-2">
            <CheckCircle className="mr-1.5 h-4 w-4" /> Completed
          </Button>
        )}
        {challenge.status === 'expired' && (
           <Button variant="outline" disabled className="w-full border-muted-foreground/50 text-muted-foreground bg-muted/20 hover:bg-muted/30 text-sm py-2">
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Expired
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

const FlagPlaceholder = ({ countryCode }: { countryCode?: string }) => {
  if (!countryCode) return <div className="w-6 h-4 bg-muted rounded-sm" data-ai-hint="placeholder flag"></div>;
  return (
    <div className="w-6 h-4 bg-card-foreground text-background text-[10px] font-bold flex items-center justify-center rounded-sm shadow" data-ai-hint={`${countryCode} flag`}>
      {countryCode.substring(0, 2).toUpperCase()}
    </div>
  );
};

const RankChangeIcon = ({ change }: { change?: 'up' | 'down' | 'same' }) => {
  const randomChange = Math.random();
  if (randomChange < 0.33) return <ArrowUpRight className="h-4 w-4 text-green-400" />;
  if (randomChange < 0.66) return <ArrowDownRight className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground/50" />;
};

const LeaderboardListComponent = ({ data, type, currentUserData }: { data: LeaderboardItem[], type: 'player' | 'team' | 'country', currentUserData?: LeaderboardItem | null }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_DISPLAY_COUNT = 10;
  const EXPANDED_DISPLAY_COUNT = 20;

  const displayData = isExpanded ? data.slice(0, EXPANDED_DISPLAY_COUNT) : data.slice(0, INITIAL_DISPLAY_COUNT);
  const isCurrentUserInDisplayData = currentUserData && displayData.some(item => item.id === currentUserData.id);
  const showCurrentUserSeparately = type === 'player' && currentUserData && !isCurrentUserInDisplayData && currentUserData.rank > 0;


  if (!data || data.length === 0) {
    return (
      <Card className="bg-card/80 shadow-md my-4">
        <CardContent className="p-6 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-md text-muted-foreground">No data available for this tournament leaderboard section yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-1.5 mt-3">
      {displayData.map((item) => (
        <div
          key={item.id}
          className={cn(`p-2.5 rounded-md shadow-md flex items-center space-x-2.5 transition-all duration-200 hover:shadow-lg`,
            item.rank === 1 ? 'bg-gradient-to-r from-accent to-yellow-400 text-accent-foreground' : 'bg-card text-card-foreground hover:bg-card/90',
            type === 'player' && currentUserData?.id === item.id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
          )}
        >
          <span className={`text-lg font-bold w-8 text-center ${item.rank === 1 ? 'text-accent-foreground' : 'text-primary'}`}>
            {item.rank === 1 ? <Crown className="inline-block h-5 w-5 mb-0.5" /> : `#${item.rank}`}
          </span>
          <RankChangeIcon change={item.rankChange} />
          {type !== 'team' && <FlagPlaceholder countryCode={item.country} />}
          <Avatar className={`h-8 w-8 ${item.rank === 1 ? 'border-2 border-accent-foreground/50' : 'border-2 border-primary/50'}`}>
            <AvatarImage src={item.avatarUrl} alt={item.name} data-ai-hint="avatar logo"/>
            <AvatarFallback className={`text-xs ${item.rank === 1 ? 'bg-accent-foreground text-accent' : 'bg-primary text-primary-foreground'}`}>{item.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={`flex-grow font-semibold text-sm truncate ${item.rank === 1 ? 'text-accent-foreground' : 'text-card-foreground'}`}>{item.name}</span>
          {type === 'player' && item.level && <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.rank === 1 ? 'bg-accent-foreground/20 text-accent-foreground' : 'bg-primary/10 text-primary'}`}>Lvl {item.level}</span>}
          <span className={`font-bold text-md tracking-tight ${item.rank === 1 ? 'text-accent-foreground' : 'text-primary'}`}>{item.points.toLocaleString()} Tournament XP</span>
        </div>
      ))}
      {data.length > INITIAL_DISPLAY_COUNT && (
        <Button
            variant="outline"
            className="w-full mt-3 text-sm py-2"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {isExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {isExpanded ? `Show Top ${INITIAL_DISPLAY_COUNT}` : `Show Top ${Math.min(EXPANDED_DISPLAY_COUNT, data.length)}`}
        </Button>
      )}
      {showCurrentUserSeparately && currentUserData && (
        <div className="mt-4 pt-3 border-t border-dashed">
          <p className="text-sm text-center text-muted-foreground mb-1.5">Your Tournament Rank:</p>
           <div
            className={cn(`p-2.5 rounded-md shadow-md flex items-center space-x-2.5 bg-primary/10 border border-primary text-primary-foreground`)}
            >
            <span className={`text-lg font-bold w-8 text-center text-primary`}>
                #{currentUserData.rank}
            </span>
            <RankChangeIcon change={currentUserData.rankChange} />
            <FlagPlaceholder countryCode={currentUserData.country} />
            <Avatar className={`h-8 w-8 border-2 border-primary/80`}>
                <AvatarImage src={currentUserData.avatarUrl} alt={currentUserData.name} data-ai-hint="avatar logo"/>
                <AvatarFallback className={`text-xs bg-primary text-primary-foreground`}>{currentUserData.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className={`flex-grow font-semibold text-sm truncate text-primary`}>{currentUserData.name}</span>
            {currentUserData.level && <span className={`text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary`}>Lvl {currentUserData.level}</span>}
            <span className={`font-bold text-md tracking-tight text-primary`}>{currentUserData.points.toLocaleString()} Tournament XP</span>
            </div>
        </div>
      )}
    </div>
  );
};

const Loader = () => (
 <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
    <Swords className="h-16 w-16 animate-pulse text-primary mb-6" />
    <p className="text-xl text-muted-foreground">Loading tournament...</p>
  </div>
);


export default function TournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const { toast } = useToast();
  const { user: currentUser, updateUserPoints } = useAuth();

  const tournamentId = params.tournamentId as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [tournamentLinkedChallenges, setTournamentLinkedChallenges] = useState<Challenge[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const [playerLeaderboardData, setPlayerLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [teamLeaderboardData, setTeamLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [countryLeaderboardData, setCountryLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [currentUserTournamentRankInfo, setCurrentUserTournamentRankInfo] = useState<LeaderboardItem | null>(null);


  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !tournamentId || !currentUser) return;
    console.log(`[TournamentDetailsPage] useEffect triggered for tournamentId: ${tournamentId}, user: ${currentUser.id}`);

    const storedTournaments = localStorage.getItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
    let foundTournament: Tournament | undefined;
    if (storedTournaments) {
      try {
        foundTournament = JSON.parse(storedTournaments).find((t: Tournament) => t.id === tournamentId);
        console.log(`[TournamentDetailsPage] Found tournament from localStorage:`, foundTournament);
      } catch (e) { console.error("Failed to parse tournaments", e); }
    }

    if (!foundTournament) {
      toast({ title: "Tournament not found", description: "This tournament could not be loaded.", variant: "destructive" });
      router.replace('/tournaments');
      return;
    }
    setTournament(foundTournament);

    const storedChallenges = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
    let loadedChallenges: Challenge[] = [];
    if (storedChallenges) {
      try {
        loadedChallenges = JSON.parse(storedChallenges);
        setAllChallenges(loadedChallenges);
        console.log(`[TournamentDetailsPage] Loaded All Challenges:`, loadedChallenges);
        
        const associatedChallenges = loadedChallenges.filter(ch => {
            const isIncluded = foundTournament?.challengeIds?.includes(ch.id);
            console.log(`[TournamentDetailsPage] Challenge Filter: ID ${ch.id} (${ch.title}), Is in tournament challengeIds (${foundTournament?.challengeIds?.join(', ')}): ${isIncluded}`);
            return isIncluded;
        });
        setTournamentLinkedChallenges(associatedChallenges);
        console.log(`[TournamentDetailsPage] Associated Challenges after filtering:`, associatedChallenges);

      } catch (e) { console.error("Failed to parse challenges", e); }
    }

    const storedCompletions = localStorage.getItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY);
    let tournamentCompletions: TournamentCompletions = {};
    if (storedCompletions) {
      try { tournamentCompletions = JSON.parse(storedCompletions); } catch (e) { console.error("Failed to parse tournament completions", e); }
    }

    const allUsersStored = localStorage.getItem(ADMIN_MANAGED_USERS_KEY);
    let allUsers: UserType[] = [];
    if (allUsersStored) try { allUsers = JSON.parse(allUsersStored); } catch (e) { console.error("Error parsing users for leaderboard", e); }

    const playerPointsMap: { [userId: string]: number } = {};
    allUsers.forEach(user => {
      let userTournamentPoints = 0;
      const userParticipatedTournamentChallengeIds = tournamentCompletions[tournamentId]?.[user.id] || [];

      foundTournament?.challengeIds?.forEach(tournamentChallengeId => {
        const challenge = loadedChallenges.find(c => c.id === tournamentChallengeId);
        if (!challenge) return;

        if (userParticipatedTournamentChallengeIds.includes(challenge.id)) {
          if (challenge.type === 'prediction') {
            if (challenge.participationPoints && challenge.participationPoints > 0) {
              userTournamentPoints += challenge.participationPoints;
            }
            const userPrediction = localStorage.getItem(`user_prediction_${user.id}_${challenge.id}`);
            if (challenge.status === 'completed' && challenge.correctPredictionOptionId && userPrediction === challenge.correctPredictionOptionId) {
              userTournamentPoints += challenge.pointsValue;
            }
          } else {
            userTournamentPoints += challenge.pointsValue;
          }
        }
      });
      playerPointsMap[user.id] = userTournamentPoints;
    });


    const newPlayerLeaderboard = allUsers
      .filter(u => u.role === 'player')
      .map(user => ({
        id: user.id, name: user.name, avatarUrl: user.avatarUrl,
        points: playerPointsMap[user.id] || 0,
        level: user.level, country: user.country, rank: 0, rankChange: 'same' as 'same',
      }))
      .sort((a, b) => b.points - a.points)
      .map((p, index) => ({ ...p, rank: index + 1 }));
    setPlayerLeaderboardData(newPlayerLeaderboard);

    const currentUserEntry = newPlayerLeaderboard.find(p => p.id === currentUser.id);
    setCurrentUserTournamentRankInfo(currentUserEntry || { ...currentUser, points: playerPointsMap[currentUser.id] || 0, rank: newPlayerLeaderboard.findIndex(p => p.id === currentUser.id) + 1 || 0, name: currentUser.name, avatarUrl: currentUser.avatarUrl, level: currentUser.level, country: currentUser.country });


    const teamsStored = localStorage.getItem(TEAMS_STORAGE_KEY);
    let allTeams: TeamType[] = [];
    if (teamsStored) try { allTeams = JSON.parse(teamsStored); } catch (e) { console.error("Error parsing teams for leaderboard", e); }

    const newTeamLeaderboard = allTeams
      .map(team => {
        let teamTournamentPoints = 0;
        (team.members ?? []).forEach(member => {
          teamTournamentPoints += playerPointsMap[member.id] || 0;
        });
        return {
          id: team.id, name: team.name, avatarUrl: team.avatarUrl,
          points: teamTournamentPoints, rank: 0, rankChange: 'same' as 'same',
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((t, index) => ({ ...t, rank: index + 1 }));
    setTeamLeaderboardData(newTeamLeaderboard);

    const countryPoints: { [country: string]: number } = {};
    allUsers.forEach(user => {
      if (user.role === 'player') {
        const userCountry = user.country || "Unknown";
        countryPoints[userCountry] = (countryPoints[userCountry] || 0) + (playerPointsMap[user.id] || 0);
      }
    });

    const newCountryLeaderboard = Object.entries(countryPoints)
      .map(([name, points]) => ({
        id: name, name, avatarUrl: `https://placehold.co/40x40.png?text=${name.substring(0,2).toUpperCase()}`,
        points, rank: 0, country: name, rankChange: 'same' as 'same',
      }))
      .sort((a, b) => b.points - a.points)
      .map((c, index) => ({ ...c, rank: index + 1 }));
    setCountryLeaderboardData(newCountryLeaderboard);

    const completedChallengeIdParam = searchParamsHook.get('challengeCompletedInTournament');
    if (completedChallengeIdParam) {
        toast({ title: "Challenge Completed!", description: `Your points for this tournament have been updated.` });
        router.replace(`/tournaments/${tournamentId}`, { scroll: false }); 
    }
  }, [tournamentId, currentUser, isMounted, router, toast, searchParamsHook]);


  const handleChallengeAction = (challenge: Challenge, currentTournamentId: string) => {
    if (!currentUser) return;

    if (challenge.type === 'social' && challenge.status === 'active') {
        const storedCompletions = localStorage.getItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY);
        let tournamentCompletions: TournamentCompletions = {};
        if (storedCompletions) {
          try { tournamentCompletions = JSON.parse(storedCompletions); } catch (e) { console.error("Failed to parse tournament completions", e); }
        }
        const userTournamentComps = tournamentCompletions[currentTournamentId]?.[currentUser.id] || [];
        
        if (userTournamentComps.includes(challenge.id)) {
            toast({ title: "Already Completed", description: "You've already completed this social challenge for this tournament.", variant: "default" });
            return;
        }

        updateUserPoints(challenge.pointsValue); 

        const updatedAllChallenges = allChallenges.map(c =>
          c.id === challenge.id ? { ...c, status: 'completed' as const } : c
        );
        setAllChallenges(updatedAllChallenges);
        localStorage.setItem(LOCAL_STORAGE_CHALLENGES_KEY, JSON.stringify(updatedAllChallenges));

        if (!tournamentCompletions[currentTournamentId]) tournamentCompletions[currentTournamentId] = {};
        if (!tournamentCompletions[currentTournamentId][currentUser.id]) tournamentCompletions[currentTournamentId][currentUser.id] = [];
        tournamentCompletions[currentTournamentId][currentUser.id].push(challenge.id);
        localStorage.setItem(TOURNAMENT_USER_CHALLENGE_COMPLETIONS_KEY, JSON.stringify(tournamentCompletions));
        
        
        toast({ title: "Social Challenge Complete!", description: `You earned ${challenge.pointsValue} XP! Tournament leaderboard will update.` });
        setTournament(prev => prev ? {...prev, challengeIds: [...(prev.challengeIds ?? [])]} : null);


    } else if (challenge.type === 'quiz') {
      router.push(`/challenges/${challenge.id}?tournamentContext=${currentTournamentId}`);
    } else if (challenge.type === 'prediction') {
      router.push(`/challenges/prediction/${challenge.id}?tournamentContext=${currentTournamentId}`);
    } else {
      toast({ title: "Challenge Info", description: "This challenge type is handled on its dedicated page or already completed.", variant: "default" });
    }
  };


  if (!isMounted || !tournament || !currentUser) {
    return <Loader />;
  }

  const formattedEndDate = isValid(parseISO(tournament.endDate)) ? format(parseISO(tournament.endDate), 'MMM d, yyyy') : 'N/A';

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden bg-card/80 backdrop-blur-sm border border-primary/20">
        {tournament.imageUrl && (
          <div className="relative h-56 md:h-72">
            <Image src={tournament.imageUrl} alt={tournament.name} layout="fill" objectFit="cover" data-ai-hint="tournament banner large"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
          </div>
        )}
        <CardHeader className={`relative ${tournament.imageUrl ? '-mt-20 md:-mt-24 z-10 px-6 pb-6 pt-0 text-white' : 'px-6 py-6'}`}>
          <Button variant="ghost" size="sm" onClick={() => router.push('/tournaments')} className={`mb-3 text-sm ${tournament.imageUrl ? 'text-gray-300 hover:text-white' : 'text-muted-foreground hover:text-foreground'} self-start -ml-2`}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Tournaments
          </Button>
          <CardTitle className={`text-4xl md:text-5xl font-bold ${tournament.imageUrl ? 'text-white drop-shadow-lg' : 'text-primary'}`}>{tournament.name}</CardTitle>
          <CardDescription className={`text-lg ${tournament.imageUrl ? 'text-gray-200 drop-shadow-sm' : 'text-muted-foreground'}`}>
            {tournament.description}
          </CardDescription>
          <div className={`flex items-center text-sm gap-4 mt-3 ${tournament.imageUrl ? 'text-gray-300' : 'text-muted-foreground'}`}>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-5 w-5" /> Ends: {formattedEndDate}
            </div>
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-5 w-5" /> {(tournament.challengeIds ?? []).length} Challenges
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-lg bg-card/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center"><Trophy className="mr-3 h-7 w-7 text-accent"/>Tournament Leaderboards</CardTitle>
          <CardDescription>Points are based on completed challenges specific to this tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="players" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex h-auto p-1 rounded-lg bg-primary/20 backdrop-blur-sm">
              <TabsTrigger value="players" className="text-base py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold"><Users className="h-5 w-5 mr-2"/>Players</TabsTrigger>
              <TabsTrigger value="teams" className="text-base py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold"><Users className="h-5 w-5 mr-2"/>Teams</TabsTrigger>
              <TabsTrigger value="countries" className="text-base py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold"><Globe className="h-5 w-5 mr-2"/>Countries</TabsTrigger>
            </TabsList>
            <TabsContent value="players">
              <LeaderboardListComponent data={playerLeaderboardData} type="player" currentUserData={currentUserTournamentRankInfo} />
            </TabsContent>
            <TabsContent value="teams">
              <LeaderboardListComponent data={teamLeaderboardData} type="team" />
            </TabsContent>
            <TabsContent value="countries">
              <LeaderboardListComponent data={countryLeaderboardData} type="country" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="shadow-lg bg-card/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center"><Puzzle className="mr-3 h-7 w-7 text-accent"/>Tournament Challenges</CardTitle>
          <CardDescription>Complete these challenges to earn points for this tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          {tournamentLinkedChallenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournamentLinkedChallenges.map(challenge => (
                <ChallengeCard key={challenge.id} challenge={challenge} handleChallengeAction={handleChallengeAction} tournamentId={tournament.id}/>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No challenges are currently associated with this tournament.</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}


    