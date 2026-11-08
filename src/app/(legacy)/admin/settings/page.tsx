
"use client";
import { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, CalendarOff, AlertTriangle, Database, Loader2 } from "lucide-react";
import { format, parseISO, isValid, isBefore, isEqual } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import type { User, Team } from '@/types';

const APP_SETTINGS_TEAM_LOCK_START_DATE_KEY = 'appSettings_teamLockStartDate';
const APP_SETTINGS_TEAM_LOCK_END_DATE_KEY = 'appSettings_teamLockEndDate';

const asianCountries = ["China", "Indonesia", "Malaysia", "India", "Japan", "South Korea", "Thailand", "Taiwan"];
const otherCountries = ["England", "Denmark", "France"];
const allSeedCountries = [...asianCountries, ...otherCountries];

const firstNamesByRegion: { [key: string]: string[] } = {
  China: ["Wei", "Feng", "Long", "Lin", "Yu", "Chen", "Jia", "Li"],
  Indonesia: ["Taufik", "Hendra", "Kevin", "Marcus", "Anthony", "Jonatan", "Apriyani", "Greysia"],
  Malaysia: ["Lee", "Goh", "Tan", "Aaron", "Soh", "Pearly", "Thinaah", "Azlan"],
  India: ["P.V.", "Saina", "Srikanth", "Lakshya", "Satwiksairaj", "Chirag", "Jwala", "Ashwini"],
  Japan: ["Kento", "Yuta", "Akane", "Nozomi", "Takuro", "Yugo", "Wakana", "Mayu"],
  "South Korea": ["Son", "Lee", "An", "Heo", "Kwang-hee", "Seo", "Chae", "Kim", "Jeon"],
  Thailand: ["Ratchanok", "Kunlavut", "Dechapol", "Sapsiree", "Pornpawee", "Busanan", "Jongkolphan", "Rawinda"],
  Taiwan: ["Tai", "Chou", "Lee", "Wang", "Lu", "Pai", "Hsu", "Sung"],
  England: ["Chris", "Marcus", "Lauren", "Ben", "Sean", "Chloe", "Gabby", "Toby"],
  Denmark: ["Viktor", "Anders", "Kim", "Mia", "Line", "Mads", "Rasmus"],
  France: ["Toma", "Christo", "Ronan", "Thom", "Delphine", "Anne", "Margot"]
};

const lastNamesByRegion: { [key: string]: string[] } = {
  China: ["Chen", "Li", "Zhang", "Liu", "Wang", "Yang", "Huang", "Zhao"],
  Indonesia: ["Sugiarto", "Setiawan", "Gideon", "Sukamuljo", "Ginting", "Christie", "Rahayu", "Polii"],
  Malaysia: ["Chong Wei", "V Shem", "Wee Kiong", "Chia", "Wooi Yik", "Tan", "Muralitharan", "Shah"],
  India: ["Sindhu", "Nehwal", "Kidambi", "Sen", "Rankireddy", "Shetty", "Gutta", "Ponnappa"],
  Japan: ["Momota", "Watanabe", "Yamaguchi", "Okuhara", "Hoki", "Kobayashi", "Nagahara", "Matsumoto"],
  "South Korea": ["Wan-ho", "Yong-dae", "Se-young", "Heo", "Seung-jae", "Yoo-jung", "So-yeong", "Hee-yong"],
  Thailand: ["Intanon", "Vitidsarn", "Puavaranukroh", "Taerattanachai", "Chochuwong", "Ongbamrungphan", "Kititharakul", "Prajongjai"],
  Taiwan: ["Tzu-ying", "Tien-chen", "Yang", "Chi-lin", "Ching-yao", "Pai", "Ya-ching", "Shao-chieh"],
  England: ["Adcock", "Ellis", "Smith", "Lane", "Vendy", "Birch", "White", "Penty"],
  Denmark: ["Axelsen", "Antonsen", "Astrup", "Blichfeldt", "Kjaersfeldt", "Pieler Kolding", "Søgaard"],
  France: ["Popov", "Popov", "Labar", "Gicquel", "Delrue", "Tran", "Lambert"]
};

const teamNameSuffixes = ["Eagles", "Warriors", "Strikers", "Shuttlers", "Aces", "Rockets", "Smashers", "Dragons", "Lions", "Tigers"];
const emailProviders = ["gmail.com", "yahoo.com", "outlook.com", "badmin.demo"];


export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [teamLockStartDate, setTeamLockStartDate] = useState<string>(''); 
  const [teamLockEndDate, setTeamLockEndDate] = useState<string>(''); 
  const [dateError, setDateError] = useState<string | null>(null);
  const [isSeedingUsers, setIsSeedingUsers] = useState(false);
  const [isSeedingTeams, setIsSeedingTeams] = useState(false);

  useEffect(() => {
    const storedStartDate = localStorage.getItem(APP_SETTINGS_TEAM_LOCK_START_DATE_KEY);
    if (storedStartDate && isValid(parseISO(storedStartDate))) {
      setTeamLockStartDate(storedStartDate);
    }
    const storedEndDate = localStorage.getItem(APP_SETTINGS_TEAM_LOCK_END_DATE_KEY);
    if (storedEndDate && isValid(parseISO(storedEndDate))) {
      setTeamLockEndDate(storedEndDate);
    }
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const newDateValue = e.target.value;
    if (type === 'start') {
      setTeamLockStartDate(newDateValue);
    } else {
      setTeamLockEndDate(newDateValue);
    }
    setDateError(null);
  };

  const validateDates = (): boolean => {
    if (teamLockStartDate && teamLockEndDate) {
      const start = parseISO(teamLockStartDate);
      const end = parseISO(teamLockEndDate);
      if (isValid(start) && isValid(end) && isBefore(end, start)) {
        setDateError("The 'Lock Until' date cannot be before the 'Lock From' date.");
        return false;
      }
    }
    setDateError(null);
    return true;
  };

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    if (!validateDates()) {
      toast({ title: "Invalid Date Range", description: dateError, variant: "destructive" });
      return;
    }

    if (teamLockStartDate) {
      localStorage.setItem(APP_SETTINGS_TEAM_LOCK_START_DATE_KEY, teamLockStartDate);
    } else {
      localStorage.removeItem(APP_SETTINGS_TEAM_LOCK_START_DATE_KEY);
    }
    if (teamLockEndDate) {
      localStorage.setItem(APP_SETTINGS_TEAM_LOCK_END_DATE_KEY, teamLockEndDate);
    } else {
      localStorage.removeItem(APP_SETTINGS_TEAM_LOCK_END_DATE_KEY);
    }
    toast({ title: "Settings Saved", description: "Team lock period has been updated." });
  };
  
  const formatDateForInput = (isoDateString?: string): string => {
    if (!isoDateString || !isValid(parseISO(isoDateString))) return '';
    // Format to 'yyyy-MM-dd' which is what the date input expects
    return format(parseISO(isoDateString), 'yyyy-MM-dd');
  };
  
  const handleSeedUsers = async () => {
    setIsSeedingUsers(true);
    toast({ title: "Starting User Seeding...", description: "Generating 1000 users. This may take a moment." });

    const totalUsersToSeed = 1000;
    let usersCreated = 0;
    
    for (let i = 0; i < totalUsersToSeed; i++) {
        const country = Math.random() < 0.95 ? asianCountries[Math.floor(Math.random() * asianCountries.length)] : otherCountries[Math.floor(Math.random() * otherCountries.length)];
        const firstName = firstNamesByRegion[country][Math.floor(Math.random() * firstNamesByRegion[country].length)];
        const lastName = lastNamesByRegion[country][Math.floor(Math.random() * lastNamesByRegion[country].length)];
        const name = `${firstName} ${lastName}`;
        
        // Sanitize name for email creation
        const sanitizedName = (firstName + lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
        const domain = emailProviders[Math.floor(Math.random() * emailProviders.length)];
        const email = `${sanitizedName}${i}@${domain}`;

        const password = "password123";
        const points = Math.floor(Math.random() * 50000) + 100;
        const level = Math.floor(points / 250) + 1;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    email, // Add email here to ensure it's available for the profile trigger
                    firstName,
                    lastName,
                    avatarUrl: `https://placehold.co/100x100.png?text=${firstName.charAt(0)}${lastName.charAt(0)}`,
                    points,
                    level,
                    country,
                    continent: asianCountries.includes(country) ? "Asia" : "Europe",
                    role: 'player',
                    agreedToTerms: true,
                    referralCode: `DUMMY${i}`
                }
            }
        });
        
        if (error) {
            console.error(`User Seeding Error on user ${i+1} (${email}):`, error);
            if (error.message.includes('User already registered') || error.message.includes('already exists')) {
                if ((i + 1) % 100 === 0) {
                    toast({ title: "Seeding Progress...", description: `${i + 1} / ${totalUsersToSeed} users processed (some existed).` });
                }
                continue;
            }
            toast({ title: "User Seeding Error", description: `Failed on user ${i+1}: ${error.message}. Process stopped.`, variant: "destructive", duration: 10000 });
            setIsSeedingUsers(false);
            return;
        }

        if (data.user) {
            usersCreated++;
            if (usersCreated % 100 === 0) {
                toast({ title: "Seeding Progress...", description: `${usersCreated} / ${totalUsersToSeed} users created.` });
            }
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }

    toast({ title: "User Seeding Complete!", description: `Successfully processed ${totalUsersToSeed} users.` });
    setIsSeedingUsers(false);
  };

  const handleSeedTeams = async () => {
    setIsSeedingTeams(true);
    toast({ title: "Starting Team Seeding...", description: "Generating 100 teams and assigning users." });

    const { data: users, error: userError } = await supabase.from('profiles').select('id, country, teamId').eq('role', 'player');

    if (userError || !users) {
        toast({ title: "Error", description: `Could not fetch users to form teams: ${userError?.message}`, variant: "destructive" });
        setIsSeedingTeams(false);
        return;
    }
    
    const unassignedUsers = users.filter(u => !u.teamId);

    if (unassignedUsers.length === 0) {
        toast({ title: "No Users Available", description: "No unassigned users found to create teams.", variant: "default" });
        setIsSeedingTeams(false);
        return;
    }
    
    const usersByCountry: { [key: string]: { id: string }[] } = {};
    for (const user of unassignedUsers) {
        if (!user.country) continue;
        if (!usersByCountry[user.country]) {
            usersByCountry[user.country] = [];
        }
        usersByCountry[user.country].push({ id: user.id });
    }

    const teamMemberUpdates: { id: string, teamId: string }[] = [];
    const totalTeamsToSeed = 100;
    let teamsCreated = 0;

    for (let i = 0; i < totalTeamsToSeed; i++) {
        const country = allSeedCountries[Math.floor(Math.random() * allSeedCountries.length)];
        const suffix = teamNameSuffixes[Math.floor(Math.random() * teamNameSuffixes.length)];
        const teamName = `${country} ${suffix}`;
        
        const availableMembersFromCountry = (usersByCountry[country] || []).filter(u => !teamMemberUpdates.some(upd => upd.id === u.id));
        if (availableMembersFromCountry.length === 0) {
            console.warn(`No more available members from ${country} to create team ${i+1}. Skipping.`);
            continue;
        }

        const captain = availableMembersFromCountry.shift();
        if (!captain) continue;

        const newTeamForDb = {
            name: teamName,
            captainId: captain.id,
            description: `The official team for the ${teamName}, representing ${country}.`,
            avatarUrl: `https://placehold.co/100x100.png?text=${country.substring(0,2).toUpperCase()}`
        };

        const { data: insertedTeam, error: teamInsertError } = await supabase.from('teams').insert(newTeamForDb).select().single();
        if(teamInsertError || !insertedTeam) {
            console.error('Failed to insert team, skipping:', teamInsertError);
            continue;
        }
        teamsCreated++;
        if (teamsCreated % 10 === 0) {
            toast({ title: "Seeding Progress", description: `${teamsCreated} / ${totalTeamsToSeed} teams created. Assigning members...` });
        }

        teamMemberUpdates.push({ id: captain.id, teamId: insertedTeam.id });
        
        const membersToAssign = availableMembersFromCountry.slice(0, 9);
        for(const member of membersToAssign) {
            teamMemberUpdates.push({ id: member.id, teamId: insertedTeam.id });
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }

    const chunkSize = 100;
    for (let i = 0; i < teamMemberUpdates.length; i += chunkSize) {
        const chunk = teamMemberUpdates.slice(i, i + chunkSize);
        const updates = chunk.map(u => supabase.from('profiles').update({ teamId: u.teamId }).eq('id', u.id));
        await Promise.all(updates);
    }
    
    toast({ title: "Team Seeding Complete!", description: `Successfully created ${teamsCreated} teams and assigned ${teamMemberUpdates.length} members.` });
    setIsSeedingTeams(false);
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Settings className="h-8 w-8 mr-3 text-accent" /> App Settings
          </CardTitle>
          <CardDescription className="text-lg">
            Configure global application settings and restrictions.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <CalendarOff className="h-6 w-6 mr-2 text-destructive" /> Team Transfer Lock Period
          </CardTitle>
          <CardDescription>
            Set a date range during which players cannot leave their current teams.
            Leaving dates blank removes the specific restriction (from/until).
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveSettings}>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="teamLockStartDate" className="text-base">
                Lock Team Leaving From (inclusive)
              </Label>
              <Input
                id="teamLockStartDate"
                type="date"
                value={formatDateForInput(teamLockStartDate)}
                onChange={(e) => handleDateChange(e, 'start')}
                className="mt-1"
              />
              {teamLockStartDate && isValid(parseISO(teamLockStartDate)) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Lock starts: {format(parseISO(teamLockStartDate), 'PPP')}.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="teamLockEndDate" className="text-base">
                Lock Team Leaving Until (inclusive)
              </Label>
              <Input
                id="teamLockEndDate"
                type="date"
                value={formatDateForInput(teamLockEndDate)}
                onChange={(e) => handleDateChange(e, 'end')}
                className="mt-1"
              />
               {teamLockEndDate && isValid(parseISO(teamLockEndDate)) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Lock ends: {format(parseISO(teamLockEndDate), 'PPP')}.
                </p>
              )}
            </div>
            {dateError && (
              <div className="flex items-center text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {dateError}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Save Team Lock Settings
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="shadow-lg border-destructive/50">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <Database className="h-6 w-6 mr-2 text-destructive" /> Developer: Data Seeding
          </CardTitle>
          <CardDescription>
            Use these actions to populate your database with dummy data. This is for development and testing purposes only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={handleSeedUsers} disabled={isSeedingUsers || isSeedingTeams} className="w-full sm:w-auto">
                    {isSeedingUsers ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Generate 1000 Dummy Users
                </Button>
                 <Button onClick={handleSeedTeams} disabled={isSeedingTeams || isSeedingUsers} className="w-full sm:w-auto">
                    {isSeedingTeams ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Generate 100 Dummy Teams & Assign
                </Button>
             </div>
             <p className="text-xs text-muted-foreground">
                Note: This creates new Supabase Auth users and their corresponding profiles. If a user email already exists, it will be skipped.
             </p>
        </CardContent>
      </Card>

    </div>
  )
}