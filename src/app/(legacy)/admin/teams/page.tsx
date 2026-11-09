
"use client";
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Edit3, Trash2, Shield } from "lucide-react";
import type { Team } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';

const TEAMS_STORAGE_KEY = 'userTeams';

export default function AdminTeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    console.log("AdminTeamsPage: useEffect running to load teams.");
    const storedTeamsJson = localStorage.getItem(TEAMS_STORAGE_KEY);
    console.log(`AdminTeamsPage: Teams JSON from localStorage (key '${TEAMS_STORAGE_KEY}'):`, storedTeamsJson);
    if (storedTeamsJson) {
      try {
        const loadedTeams: Team[] = JSON.parse(storedTeamsJson);
        if (Array.isArray(loadedTeams)) {
          setTeams(loadedTeams);
          console.log("AdminTeamsPage: Successfully loaded and set teams from localStorage:", loadedTeams);
        } else {
          console.warn(`AdminTeamsPage: Data in localStorage for key '${TEAMS_STORAGE_KEY}' was not an array. Resetting to empty.`);
          setTeams([]);
        }
      } catch (e) {
        console.error(`AdminTeamsPage: Failed to parse teams from localStorage (key '${TEAMS_STORAGE_KEY}'). Error:`, e);
        setTeams([]); 
      }
    } else {
      console.log(`AdminTeamsPage: No teams found in localStorage for key '${TEAMS_STORAGE_KEY}'. Setting to empty array.`);
      setTeams([]); 
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      if (teams.length > 0) {
        localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
      } else {
        localStorage.removeItem(TEAMS_STORAGE_KEY); // Clear if no teams
      }
    }
  }, [teams, isMounted]);


  const filteredTeams = useMemo(() => {
    return teams.filter(team =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teams, searchTerm]);

  const handleDeleteTeam = (teamId: string) => {
    const updatedTeams = teams.filter(t => t.id !== teamId);
    setTeams(updatedTeams);
    // localStorage update will happen in the useEffect hook for `teams`
    toast({ title: "Team Deleted", description: `Team with ID ${teamId} has been removed.` });
  };

  const handleEditTeam = (teamId: string) => {
    console.log("Attempting to edit team:", teamId);
    toast({ title: "Edit Action", description: "Edit functionality for teams is not yet fully implemented on this page."});
  };
  
  const handleAddNewTeam = () => {
      console.log("Attempting to add new team via admin page.");
      toast({ title: "Add New Team", description: "Admin 'Add New Team' could open a dialog or use the user creation flow. Not fully implemented here." });
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Shield className="h-8 w-8 mr-3 text-accent" /> Team Management
          </CardTitle>
          <CardDescription className="text-lg">
            Oversee all teams, manage memberships, and edit team details.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                type="search" 
                placeholder="Search teams by name..."
                className="pl-10 h-11 text-base w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={handleAddNewTeam} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base py-2.5 px-5 w-full md:w-auto">
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Team (Admin)
            </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Logo</TableHead>
                <TableHead>Team Name</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead className="text-center">Members</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
                <TableHead className="text-center w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.map((team) => (
                <TableRow key={team.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={team.avatarUrl} alt={team.name} data-ai-hint="team logo"/>
                      <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{(team.members ?? []).find(m => m.id === team.captainId)?.name || 'N/A'}</TableCell>
                  <TableCell className="text-center">{(team.members ?? []).length} / 10</TableCell>
                  <TableCell className="text-right">{(team.points || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                     <AlertDialog>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditTeam(team.id)}>
                            <Edit3 className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently delete the team &quot;{team.name}&quot; and all associated data from localStorage. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTeam(team.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Yes, delete team
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {filteredTeams.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">No teams found matching your criteria, or no teams have been created by users yet.</div>
        )}
      </Card>
    </div>
  );
}

