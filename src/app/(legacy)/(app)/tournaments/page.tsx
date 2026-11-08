
"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Swords, CalendarDays, ListChecks, Loader2, Trophy } from "lucide-react";
import type { Tournament } from '@/types';
import { format, parseISO, isValid, isPast } from 'date-fns';

const LOCAL_STORAGE_TOURNAMENTS_KEY = 'adminTournaments';

const TournamentStatusBadge = ({ endDate }: { endDate: string }) => {
  const now = new Date();
  const end = parseISO(endDate);

  if (!isValid(end)) {
    return <Badge variant="outline">Date Invalid</Badge>;
  }

  if (isPast(end)) {
    return <Badge variant="destructive" className="bg-gray-500/80 text-white border-gray-500">Ended</Badge>;
  }
  // If not ended, it's considered active or scheduled to end.
  return <Badge variant="default" className="bg-green-500/80 text-white border-green-500 animate-pulse">Active</Badge>;
};

const TournamentCard = ({ tournament }: { tournament: Tournament }) => {
  const formattedEndDate = isValid(parseISO(tournament.endDate)) ? format(parseISO(tournament.endDate), 'MMM d, yyyy') : 'N/A';

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col bg-card/80 backdrop-blur-sm border border-primary/20">
      {tournament.imageUrl && (
        <Image 
            src={tournament.imageUrl} 
            alt={tournament.name} 
            width={400} 
            height={200} 
            className="w-full h-40 object-cover rounded-t-lg"
            data-ai-hint="tournament banner"
        />
      )}
      {!tournament.imageUrl && (
         <div className="w-full h-40 bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center rounded-t-lg">
            <Swords className="h-16 w-16 text-primary/70" />
         </div>
      )}
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="text-xl font-bold text-card-foreground">{tournament.name}</CardTitle>
            <TournamentStatusBadge endDate={tournament.endDate} />
        </div>
        <CardDescription className="text-sm text-muted-foreground line-clamp-2">{tournament.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 mr-2 text-primary" />
          <span>Ends: {formattedEndDate}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4 mr-2 text-primary" />
          <span>{tournament.challengeIds.length} Challenges</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full btn-game">
          <Link href={`/tournaments/${tournament.id}`}>View Tournament</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    setIsLoading(true);
    const storedTournaments = localStorage.getItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
    if (storedTournaments) {
      try {
        const parsedTournaments: Tournament[] = JSON.parse(storedTournaments);
        // Sort tournaments: Active first, then Past (Ended)
        // Within each group, sort by end date (most recently ending first)
        parsedTournaments.sort((a, b) => {
            const now = new Date();
            const aEnd = parseISO(a.endDate);
            const bEnd = parseISO(b.endDate);

            const aIsActive = isValid(aEnd) && !isPast(aEnd);
            const bIsActive = isValid(bEnd) && !isPast(bEnd);
            const aIsPast = isValid(aEnd) && isPast(aEnd);
            const bIsPast = isValid(bEnd) && isPast(bEnd);

            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;
            
            // If both active or both past, sort by end date (desc)
            if ((aIsActive && bIsActive) || (aIsPast && bIsPast)) {
                 if (isValid(aEnd) && isValid(bEnd)) return bEnd.getTime() - aEnd.getTime();
            }
            return 0; // Fallback
        });
        setTournaments(parsedTournaments);
      } catch (e) {
        console.error("Failed to parse tournaments from localStorage", e);
        setTournaments([]);
      }
    } else {
      setTournaments([]);
    }
    setIsLoading(false);
  }, [isMounted]);

  if (!isMounted || isLoading) {
    return (
     <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
       <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
       <p className="text-xl text-muted-foreground">Loading tournaments...</p>
     </div>
   );
 }

  return (
    <div className="space-y-8">
      <Card className="shadow-2xl bg-card/50 border-2 border-primary/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-foreground flex items-center">
            <Trophy className="h-10 w-10 mr-3 text-accent" /> Tournaments
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Compete in special events, complete challenges, and climb the tournament leaderboards!
          </CardDescription>
        </CardHeader>
      </Card>

      {tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map(tournament => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      ) : (
        <Card className="shadow-xl bg-card/80 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <Swords className="h-24 w-24 text-accent mx-auto mb-4 opacity-50" />
            <h3 className="text-2xl font-semibold text-primary mb-2">No Tournaments Yet</h3>
            <p className="text-muted-foreground">
              There are no tournaments scheduled right now. Check back soon for new events!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

