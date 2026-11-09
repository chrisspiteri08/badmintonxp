
"use client";
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { PlusCircle, Users, Search, ShieldCheck, Star } from "lucide-react";
import type { Team } from '@/types';
import { useAuth } from '@/contexts/auth-context';

const TEAMS_STORAGE_KEY = 'userTeams';

const TeamCard = ({ team }: { team: Team }) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
    <CardHeader className="relative">
      <Image 
        src={team.avatarUrl || "https://placehold.co/400x200.png"} 
        alt={`${team.name} banner`}
        data-ai-hint="team banner" 
        width={400} 
        height={200} 
        className="w-full h-32 object-cover rounded-t-lg"
      />
      <div className="absolute bottom-0 left-4 translate-y-1/2">
        <Avatar className="h-20 w-20 border-4 border-background shadow-md">
          <AvatarImage src={team.avatarUrl} alt={team.name} data-ai-hint="team logo"/>
          <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
    </CardHeader>
    <CardContent className="pt-12 flex-grow"> {/* pt-12 to make space for overlapping avatar */}
      <CardTitle className="text-xl font-bold text-primary mb-1">{team.name}</CardTitle>
      <div className="flex items-center text-sm text-muted-foreground mb-2">
        <ShieldCheck className="h-4 w-4 mr-1 text-green-500" /> Captain: {(team.members ?? []).find(m => m.id === team.captainId)?.name || 'N/A'}
      </div>
      <div className="flex items-center text-sm text-muted-foreground mb-2">
        <Users className="h-4 w-4 mr-1 text-blue-500" /> {(team.members ?? []).length} / 10 Members
      </div>
      <div className="flex items-center text-sm text-accent mb-4">
        <Star className="h-4 w-4 mr-1" /> {team.points.toLocaleString()} Team Points
      </div>
      <div className="flex -space-x-2 overflow-hidden mb-2">
        {(team.members ?? []).slice(0, 5).map(member => (
          <Avatar key={member.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
            <AvatarImage src={member.avatarUrl} data-ai-hint="profile avatar" />
            <AvatarFallback>{member.name.substring(0,1)}</AvatarFallback>
          </Avatar>
        ))}
        {(team.members ?? []).length > 5 && (
          <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
            <AvatarFallback>+{(team.members ?? []).length - 5}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </CardContent>
    <CardFooter>
      <Button asChild className="w-full bg-primary hover:bg-primary/90">
        <Link href={`/teams/${team.id}`}>View Team</Link>
      </Button>
    </CardFooter>
  </Card>
);


export default function TeamsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    console.log("TeamsPage: useEffect running to load teams.");
    const storedTeamsJson = localStorage.getItem(TEAMS_STORAGE_KEY);
    console.log(`TeamsPage: Teams JSON from localStorage (key '${TEAMS_STORAGE_KEY}'):`, storedTeamsJson);
    if (storedTeamsJson) {
      try {
        const loadedTeams: Team[] = JSON.parse(storedTeamsJson);
        if (Array.isArray(loadedTeams)) {
          setTeams(loadedTeams);
          console.log("TeamsPage: Successfully loaded and set teams from localStorage:", loadedTeams);
        } else {
          console.warn(`TeamsPage: Data in localStorage for key '${TEAMS_STORAGE_KEY}' was not an array. Resetting to empty.`);
          setTeams([]); // Initialize to empty array if not an array
        }
      } catch (e) {
        console.error(`TeamsPage: Failed to parse teams from localStorage (key '${TEAMS_STORAGE_KEY}'). Error:`, e);
        setTeams([]); // Initialize to empty array on error
      }
    } else {
      console.log(`TeamsPage: No teams found in localStorage for key '${TEAMS_STORAGE_KEY}'. Setting to empty array.`);
      setTeams([]); // Initialize to empty array if no data
    }
  }, []); 

  const filteredTeams = useMemo(() => {
    let processedTeams = teams.filter(team =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (user?.teamId) {
      const usersTeam = processedTeams.find(team => team.id === user.teamId);
      if (usersTeam) {
        processedTeams = [
          usersTeam,
          ...processedTeams.filter(team => team.id !== user.teamId).sort((a, b) => a.name.localeCompare(b.name))
        ];
      } else {
        // User's team not found in current list (e.g. after search), sort normally
        processedTeams.sort((a, b) => a.name.localeCompare(b.name));
      }
    } else {
      // User not in a team, sort all teams by name
      processedTeams.sort((a, b) => a.name.localeCompare(b.name));
    }
    return processedTeams;
  }, [searchTerm, teams, user?.teamId]);

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-primary flex items-center"><Users className="h-10 w-10 mr-3 text-accent" />Teams</CardTitle>
          <CardDescription className="text-lg">Join forces, compete together, and climb the ranks!</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search for teams..."
              className="pl-10 h-12 text-base w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {!user?.teamId && (
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base py-3 px-6 w-full md:w-auto">
              <Link href="/teams/create">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Team
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
      
      {user && !user.teamId && (
        <Card className="bg-primary/10 border-primary shadow-md">
            <CardHeader>
                <CardTitle className="text-xl text-primary">You are not currently in a team!</CardTitle>
                <CardDescription>Join a team or create your own to participate in team challenges and leaderboards.</CardDescription>
            </CardHeader>
        </Card>
      )}
       {user && user.teamId && (
        <Card className="bg-green-500/10 border-green-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-xl text-green-700">You are part of a team!</CardTitle>
                <CardDescription className="text-green-600">Your team is listed first below. You can view your team details or explore other teams.</CardDescription>
            </CardHeader>
        </Card>
      )}


      {filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <Card className="shadow-lg">
          <CardContent className="py-12 text-center">
            <Users className="h-24 w-24 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-primary mb-2">No Teams Found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? `No teams match your search criteria "${searchTerm}".` : "There are no teams to display yet."}
            </p>
            {!searchTerm && teams.length === 0 && !user?.teamId && (
                 <p className="text-muted-foreground mt-2">Why not create the first team?</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
