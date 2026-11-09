
"use client";
import Image from "next/image";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Users, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import type { Team } from '@/types';

// Explicitly use the string literal for the key here
const TEAMS_STORAGE_KEY = 'userTeams';

export default function CreateTeamPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, assignTeamToUser } = useAuth();

  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamAvatarFile, setTeamAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setTeamAvatarFile(file); // Store the file if you plan to upload it
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("CreateTeamPage: handleSubmit triggered.");

    if (!currentUser) {
        toast({ title: "Error", description: "You must be logged in to create a team.", variant: "destructive" });
        console.error("CreateTeamPage: Current user is null.");
        return;
    }
    if (!teamName.trim()) {
      toast({
        title: "Error",
        description: "Team Name is required.",
        variant: "destructive",
      });
      console.warn("CreateTeamPage: Team name is empty.");
      return;
    }

    const newTeam: Team = {
      id: `team-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: teamName.trim(),
      description: teamDescription.trim(),
      avatarUrl: avatarPreview || `https://placehold.co/100x100.png?text=${teamName.substring(0,2).toUpperCase()}`,
      members: [currentUser], 
      points: currentUser.points, 
      captainId: currentUser.id,
    };

    console.log("CreateTeamPage: Attempting to save new team:", JSON.stringify(newTeam));

    try {
        console.log(`CreateTeamPage: Attempting to get item from localStorage with key: ${TEAMS_STORAGE_KEY}`);
        const existingTeamsJson = localStorage.getItem(TEAMS_STORAGE_KEY);
        console.log("CreateTeamPage: Existing teams JSON from localStorage:", existingTeamsJson);
        
        let allTeams: Team[] = [];
        if (existingTeamsJson) {
          try {
            allTeams = JSON.parse(existingTeamsJson);
            if (!Array.isArray(allTeams)) {
                console.warn(`CreateTeamPage: localStorage '${TEAMS_STORAGE_KEY}' was not an array, resetting to empty array.`);
                allTeams = [];
            }
          } catch (parseError) {
            console.error(`CreateTeamPage: Failed to parse existing teams from localStorage with key '${TEAMS_STORAGE_KEY}', starting fresh. Error:`, parseError);
            allTeams = []; 
          }
        }
        
        allTeams.push(newTeam);
        console.log(`CreateTeamPage: Preparing to save ${allTeams.length} teams to localStorage with key '${TEAMS_STORAGE_KEY}'. Data:`, JSON.stringify(allTeams));
        localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(allTeams));
        console.log(`CreateTeamPage: Successfully called localStorage.setItem for key '${TEAMS_STORAGE_KEY}'.`);

        assignTeamToUser(newTeam.id); 

        toast({
          title: "Team Created!",
          description: `Your team "${newTeam.name}" has been successfully created.`,
        });
        router.push(`/teams/${newTeam.id}`); 
    } catch (error) {
        console.error("CreateTeamPage: Error during team creation/saving process:", error);
        toast({
            title: "Creation Failed",
            description: "An unexpected error occurred while creating the team. Check console for details.",
            variant: "destructive",
        });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Users className="h-8 w-8 mr-3 text-accent" /> Create Your Badminton Team
          </CardTitle>
          <CardDescription className="text-lg">
            Assemble your squad and get ready to conquer the leaderboards!
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-base font-medium">Team Name</Label>
              <Input 
                id="teamName" 
                placeholder="e.g., The Shuttlecocks" 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="h-11 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamDescription" className="text-base font-medium">Team Description (Optional)</Label>
              <Textarea 
                id="teamDescription" 
                placeholder="Tell everyone about your team's mission and spirit!" 
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                className="text-base min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamAvatarFile" className="text-base font-medium">Team Avatar/Logo (Optional)</Label>
              <div className="flex items-center gap-4">
                {avatarPreview ? (
                  <Image unoptimized width={80} height={80} src={avatarPreview} alt="Team Avatar Preview" className="h-20 w-20 rounded-full object-cover border-2 border-primary" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-primary">
                    <Shield className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <Input 
                  id="teamAvatarFile" 
                  type="file" 
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden" 
                />
                <Button type="button" variant="outline" onClick={() => document.getElementById('teamAvatarFile')?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Upload Image
                </Button>
              </div>
               {avatarPreview && <Button type="button" variant="link" size="sm" className="text-destructive p-0 h-auto" onClick={() => {setTeamAvatarFile(null); setAvatarPreview(null);}}>Remove image</Button>}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} className="text-base py-2.5 px-5">
              Cancel
            </Button>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base py-2.5 px-5">
              Create Team
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

    