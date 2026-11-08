
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Users, Star, Edit3, UserPlus, LogOut, Crown, Loader2 } from "lucide-react";
import type { Team, User } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isFuture, isPast, parseISO, isValid, endOfDay, format, startOfDay, isEqual } from 'date-fns';

const APP_SETTINGS_TEAM_LOCK_START_DATE_KEY = 'appSettings_teamLockStartDate';
const APP_SETTINGS_TEAM_LOCK_END_DATE_KEY = 'appSettings_teamLockEndDate';
const TEAMS_STORAGE_KEY = 'userTeams';

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, assignTeamToUser, removeUserFromTeam, isLoading: isAuthLoading } = useAuth();
  const teamId = params.teamId as string;
  
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [isLoadingTeamData, setIsLoadingTeamData] = useState(true); // Specific for team data fetching
  const [teamLockStartDate, setTeamLockStartDate] = useState<Date | null>(null);
  const [teamLockEndDate, setTeamLockEndDate] = useState<Date | null>(null);
  const [isTeamLeavingLocked, setIsTeamLeavingLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string>("Team transfers are currently restricted.");


  useEffect(() => {
    if (!teamId || !currentUser) { 
        setIsLoadingTeamData(false); 
        return;
    }
    setIsLoadingTeamData(true);
    console.log(`TeamDetailsPage (useEffect): Loading for teamId from URL: ${teamId}. Current user:`, currentUser?.id, currentUser?.teamId);
    
    const storedTeamsJson = localStorage.getItem(TEAMS_STORAGE_KEY);
    console.log(`TeamDetailsPage (useEffect): localStorage '${TEAMS_STORAGE_KEY}' content:`, storedTeamsJson);
    let foundTeamFromStorage: Team | undefined = undefined;

    if (storedTeamsJson) {
        try {
            const allTeams: Team[] = JSON.parse(storedTeamsJson);
            console.log(`TeamDetailsPage (useEffect): Parsed allTeams from localStorage:`, allTeams);
            foundTeamFromStorage = allTeams.find(t => t.id === teamId);
            console.log(`TeamDetailsPage (useEffect): Team found in localStorage for ${teamId} (before reconciliation):`, JSON.parse(JSON.stringify(foundTeamFromStorage || {})));
        } catch (e) {
            console.error("TeamDetailsPage (useEffect): Failed to parse 'userTeams' from localStorage", e);
        }
    } else {
        console.log("TeamDetailsPage (useEffect): No 'userTeams' key found in localStorage.");
    }

    if (foundTeamFromStorage) {
        let finalMembers = [...(foundTeamFromStorage.members || [])]; 
        
        if (currentUser.teamId === teamId) { 
            const userIndexInDetails = finalMembers.findIndex(m => m.id === currentUser.id);
            if (userIndexInDetails === -1) { 
                console.log("TeamDetailsPage (useEffect): Current user belongs to this team (AuthContext) but not in localStorage member list. Adding to VIEW's member list.", currentUser);
                finalMembers.push(currentUser);
            } else { 
                console.log("TeamDetailsPage (useEffect): Current user already in localStorage member list for this team. Updating with fresh data.", currentUser);
                finalMembers[userIndexInDetails] = { ...finalMembers[userIndexInDetails], ...currentUser };
            }
        } else if (currentUser.teamId && currentUser.teamId !== teamId) { 
             const userIndexInDetails = finalMembers.findIndex(m => m.id === currentUser.id);
             if (userIndexInDetails !== -1) { 
                console.log("TeamDetailsPage (useEffect): Current user does NOT belong to this team but IS in localStorage member list, removing from view.", currentUser);
                finalMembers = finalMembers.filter(m => m.id !== currentUser.id);
             }
        }
        
        const processedTeamData = { 
            ...foundTeamFromStorage, 
            members: finalMembers.map(m => ({...m, points: m.points || 0, level: m.level || 1})), // Ensure members have points/level
            points: finalMembers.reduce((sum, member) => sum + (member.points || 0), 0) 
        };
        setTeamData(processedTeamData);
        console.log(`TeamDetailsPage (useEffect): Setting teamData after reconciliation:`, JSON.parse(JSON.stringify(processedTeamData)));
    } else {
        console.log(`TeamDetailsPage (useEffect): No team found for ${teamId} in localStorage. Setting teamData to null.`);
        setTeamData(null); 
    }
    
    const storedLockStartDateStr = localStorage.getItem(APP_SETTINGS_TEAM_LOCK_START_DATE_KEY);
    const storedLockEndDateStr = localStorage.getItem(APP_SETTINGS_TEAM_LOCK_END_DATE_KEY);
    
    let currentLockStartDate: Date | null = null;
    let currentLockEndDate: Date | null = null;

    if (storedLockStartDateStr) {
        const parsed = parseISO(storedLockStartDateStr);
        if (isValid(parsed)) currentLockStartDate = startOfDay(parsed);
    }
    if (storedLockEndDateStr) {
        const parsed = parseISO(storedLockEndDateStr);
        if (isValid(parsed)) currentLockEndDate = endOfDay(parsed);
    }
    
    setTeamLockStartDate(currentLockStartDate);
    setTeamLockEndDate(currentLockEndDate);

    const now = new Date();
    let locked = false;
    let message = "Team transfers are currently restricted.";

    if (currentLockStartDate && currentLockEndDate) {
         if (now >= currentLockStartDate && now <= currentLockEndDate) {
            locked = true;
            message = `Team transfers locked: ${format(currentLockStartDate, 'MMM d')} - ${format(currentLockEndDate, 'MMM d, yyyy')}.`;
        }
    } else if (currentLockStartDate) { 
        if (now >= currentLockStartDate) {
            locked = true;
            message = `Team transfers locked from ${format(currentLockStartDate, 'PPP')}.`;
        }
    } else if (currentLockEndDate) { 
        if (now <= currentLockEndDate) {
            locked = true;
            message = `Team transfers locked until ${format(currentLockEndDate, 'PPP')}.`;
        }
    }
    setIsTeamLeavingLocked(locked);
    setLockMessage(message);
    setIsLoadingTeamData(false);
  }, [teamId, currentUser]); 


  if (isAuthLoading || isLoadingTeamData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading team details...</p>
      </div>
    );
  }

  if (!currentUser) { 
     router.push('/login');
     return <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><p>Redirecting...</p></div>;
  }

  if (!teamData) {
    console.log("TeamDetailsPage (render): Rendering 'Team Not Found' because teamData is null.");
    return (
      <Card className="text-center p-8 shadow-xl">
        <CardTitle className="text-2xl font-bold text-destructive">Team Not Found</CardTitle>
        <CardDescription className="text-muted-foreground">The team you are looking for (ID: {teamId}) does not exist or could not be loaded.</CardDescription>
        <Button onClick={() => router.push('/teams')} className="mt-6 btn-game">Back to Teams</Button>
      </Card>
    );
  }
  
  const team = teamData; 

  const isUserDefinitelyMemberOfThisTeamPage = currentUser.teamId === team.id; 
  const isUserCaptainOfThisTeam = isUserDefinitelyMemberOfThisTeamPage && currentUser.id === team.captainId;
  const canUserJoinThisTeam = !currentUser.teamId && team.members.length < 10;


  const updateTeamInLocalStorage = (updatedTeam: Team) => {
    const storedTeamsJson = localStorage.getItem(TEAMS_STORAGE_KEY);
    let allTeams: Team[] = [];
    if (storedTeamsJson) {
      try {
        allTeams = JSON.parse(storedTeamsJson);
      } catch (e) {
        console.error("Error parsing userTeams from localStorage for update", e);
        toast({ title: "Error", description: "Could not update team in storage.", variant: "destructive"});
        return;
      }
    }
    const teamIndex = allTeams.findIndex(t => t.id === updatedTeam.id);
    if (teamIndex !== -1) {
      allTeams[teamIndex] = updatedTeam;
    } else {
      allTeams.push(updatedTeam); 
    }
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(allTeams));
    console.log(`TeamDetailsPage (updateTeamInLocalStorage): Updated team ${updatedTeam.id} in localStorage. New members count: ${updatedTeam.members.length}`);
  };


  const handleJoinTeam = () => {
    if (!currentUser || !teamData) return; 
    
    assignTeamToUser(teamData.id); 
    
    const newMembersList = teamData.members.filter(m => m.id !== currentUser.id); 
    newMembersList.push({...currentUser, teamId: teamData.id}); // Add user with updated teamId

    const updatedTeamForStorage = { 
        ...teamData, 
        members: newMembersList, 
        points: newMembersList.reduce((sum, m) => sum + (m.points || 0), 0) 
    };
    setTeamData(updatedTeamForStorage); 
    updateTeamInLocalStorage(updatedTeamForStorage);

    toast({ title: "Joined Team!", description: `You have successfully joined ${teamData.name}.` });
  };

  const handleLeaveTeam = () => {
    if (!currentUser || !teamData) return;
    if (isTeamLeavingLocked) {
        toast({ title: "Action Restricted", description: lockMessage, variant: "destructive"});
        return;
    }
    
    removeUserFromTeam(); 
    
    const newMembersList = teamData.members.filter(m => m.id !== currentUser.id);
    const updatedTeamForStorage: Team = { 
        ...teamData, 
        members: newMembersList, 
        points: newMembersList.reduce((sum, m) => sum + (m.points || 0), 0),
        captainId: teamData.captainId // Preserve captainId initially
    };
    
    if (currentUser.id === teamData.captainId && newMembersList.length > 0) {
        // Captain is leaving, assign new captain based on highest XP
        const sortedMembers = [...newMembersList].sort((a, b) => (b.points || 0) - (a.points || 0));
        updatedTeamForStorage.captainId = sortedMembers[0].id; 
        const newCaptain = sortedMembers[0];
        toast({ title: "Captain Changed", description: `${newCaptain.name} is the new captain of ${updatedTeamForStorage.name}.`, variant: "default" });
    } else if (currentUser.id === teamData.captainId && newMembersList.length === 0) {
        // Captain leaves and team becomes empty
        updatedTeamForStorage.captainId = ''; // Or some other indicator of no captain
        console.log(`Team ${updatedTeamForStorage.name} is now empty and has no captain.`);
    }


    setTeamData(updatedTeamForStorage);
    updateTeamInLocalStorage(updatedTeamForStorage);

    toast({ title: "Left Team", description: `You have left ${teamData.name}.`, variant: "destructive" });
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <div className="relative h-48 bg-gradient-to-r from-primary to-accent">
            <Image src={`https://placehold.co/1200x300.png?text=${team.name.replace(/\s/g,'+')}`} alt={`${team.name} Banner`} layout="fill" objectFit="cover" data-ai-hint="team banner badminton"/>
            <div className="absolute inset-0 bg-black/30"/>
        </div>
        <CardHeader className="relative -mt-16 sm:-mt-20 z-10 flex flex-col sm:flex-row items-center sm:items-end gap-4 px-6 pb-4">
            <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-4 border-background shadow-lg bg-card">
              <AvatarImage src={team.avatarUrl} alt={team.name} data-ai-hint="team logo" />
              <AvatarFallback className="text-4xl">{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left pt-2">
              <CardTitle className="text-4xl font-bold text-primary">{team.name}</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">{team.description || "United by passion, driven by victory."}</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="px-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start p-4 bg-background rounded-lg shadow">
                <Star className="h-8 w-8 text-accent mb-2" />
                <p className="text-2xl font-bold text-primary">{team.points.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Team Points</p>
            </div>
            <div className="flex flex-col items-center md:items-start p-4 bg-background rounded-lg shadow">
                <Users className="h-8 w-8 text-primary mb-2" />
                <p className="text-2xl font-bold text-primary">{team.members.length} / 10</p>
                <p className="text-sm text-muted-foreground">Members</p>
            </div>
            <div className="flex flex-col items-center md:items-start p-4 bg-background rounded-lg shadow">
                <ShieldCheck className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-xl font-semibold text-primary">{team.members.find(m => m.id === team.captainId)?.name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">Captain</p>
            </div>
        </CardContent>
        <CardFooter className="px-6 py-4 flex flex-wrap gap-2 justify-center md:justify-end">
            {isUserCaptainOfThisTeam && <Button variant="outline" className="border-accent text-accent hover:bg-accent/10"><Edit3 className="mr-2 h-4 w-4"/> Manage Team (No Op)</Button>}
            
            {isUserDefinitelyMemberOfThisTeamPage && (
              isTeamLeavingLocked ? (
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <span tabIndex={0}> 
                            <Button variant="destructive" disabled>
                            <LogOut className="mr-2 h-4 w-4"/> Leave Team
                            </Button>
                        </span>
                        </TooltipTrigger>
                        <TooltipContent>
                        <p>{lockMessage}</p>
                        </TooltipContent>
                    </Tooltip>
                    </TooltipProvider>
                    <span className="text-xs text-muted-foreground">{lockMessage}</span>
                </div>
              ) : (
                <Button variant="destructive" onClick={handleLeaveTeam}>
                  <LogOut className="mr-2 h-4 w-4"/> Leave Team
                </Button>
              )
            )}

            {!isUserDefinitelyMemberOfThisTeamPage && canUserJoinThisTeam && (
                <Button onClick={handleJoinTeam} className="bg-accent hover:bg-accent/90 text-accent-foreground"><UserPlus className="mr-2 h-4 w-4"/> Join Team</Button>
            )}
            
            {!isUserDefinitelyMemberOfThisTeamPage && currentUser.teamId && currentUser.teamId !== team.id && (
                 <Button disabled variant="outline">You're in another team</Button>
            )}
            {!isUserDefinitelyMemberOfThisTeamPage && !currentUser.teamId && team.members.length >= 10 && (
                 <Button disabled variant="outline">Team Full</Button>
            )}
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {team.members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {team.members.map(member => (
                <div key={member.id} className="flex items-center gap-3 p-3 bg-background rounded-lg shadow-sm border border-border">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint="profile avatar"/>
                    <AvatarFallback>{member.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground flex items-center">
                      {member.name}
                      {member.id === team.captainId && <Crown className="ml-2 h-4 w-4 text-yellow-500" title="Captain"/>}
                    </p>
                    <p className="text-xs text-muted-foreground">Level {member.level} - {member.points.toLocaleString()} XP</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">This team currently has no members.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="text-2xl text-primary">Team Stats &amp; Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label className="text-sm font-medium text-muted-foreground">Team Rank (Global): #{/* Placeholder */}</Label>
                <Progress value={Math.min(team.points / 100, 100)} className="h-3 mt-1" indicatorClassName="bg-accent"/> 
            </div>
            <div>
                <Label className="text-sm font-medium text-muted-foreground">Recent Tournament Performance: N/A</Label>
                 <p className="text-xs text-muted-foreground">Next tournament registration opens soon.</p>
            </div>
        </CardContent>
      </Card>
      
      {isUserDefinitelyMemberOfThisTeamPage && (
        <div className="mt-8 flex flex-col items-center gap-2">
          {isTeamLeavingLocked ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="destructive" size="lg" disabled className="w-full md:w-auto text-lg py-3">
                        <LogOut className="mr-2 h-5 w-5"/> Leave Team
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{lockMessage}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-sm text-muted-foreground text-center">{lockMessage}</p>
            </>
          ) : (
            <Button variant="destructive" size="lg" onClick={handleLeaveTeam} className="w-full md:w-auto text-lg py-3">
              <LogOut className="mr-2 h-5 w-5"/> Leave Team
            </Button>
          )}
        </div>
      )}

    </div>
  );
}


    