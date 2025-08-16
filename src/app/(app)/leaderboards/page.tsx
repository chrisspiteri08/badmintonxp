
"use client";
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Filter, Globe, Users, Trophy, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { LeaderboardItem, User as UserType, Team as TeamType } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context'; // To get current user for context if needed

const ADMIN_MANAGED_USERS_KEY = 'adminManagedUsers';
const TEAMS_STORAGE_KEY = 'userTeams';

const FlagPlaceholder = ({ countryCode }: { countryCode?: string }) => {
  if (!countryCode) return <div className="w-8 h-5 bg-muted rounded-sm" data-ai-hint="placeholder flag"></div>;
  return (
    <div className="w-8 h-5 bg-card-foreground text-background text-xs font-bold flex items-center justify-center rounded-sm shadow-md" data-ai-hint={`${countryCode} flag`}>
      {countryCode.substring(0, 2).toUpperCase()}
    </div>
  );
};

const RankChangeIcon = ({ change }: { change?: 'up' | 'down' | 'same' }) => {
  // Simplified: For now, real rank change is not calculated.
  // Could be enhanced if historical data was stored.
  // Let's make it random for visual variety if needed, or just a static icon.
  const randomChange = Math.random();
  if (randomChange < 0.33) return <ArrowUpRight className="h-5 w-5 text-green-400" />;
  if (randomChange < 0.66) return <ArrowDownRight className="h-5 w-5 text-red-400" />;
  return <Minus className="h-5 w-5 text-muted-foreground/50" />;
};


const LeaderboardListComponent = ({ data, type }: { data: LeaderboardItem[], type: 'player' | 'team' | 'country' }) => {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-card/80 shadow-xl my-4">
        <CardContent className="p-10 text-center">
          <Trophy className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">No data available for this leaderboard.</p>
          {type === 'player' && <p className="text-sm text-muted-foreground mt-2">Try adding some users in the Admin panel!</p>}
          {type === 'team' && <p className="text-sm text-muted-foreground mt-2">Try creating some teams!</p>}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2 mt-4">
      {data.map((item) => (
        <div 
          key={item.id} 
          className={`p-3 rounded-lg shadow-lg flex items-center space-x-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl
            ${item.rank === 1 ? 'bg-gradient-to-r from-accent to-yellow-400 text-accent-foreground' : 'bg-card text-card-foreground hover:bg-card/90'}`}
        >
          <span className={`text-xl font-bold w-10 text-center ${item.rank === 1 ? 'text-accent-foreground' : 'text-primary'}`}>
            {item.rank === 1 ? <Crown className="inline-block h-6 w-6 mb-1" /> : `#${item.rank}`}
          </span>
          <RankChangeIcon change={item.rankChange} />
          {type !== 'team' && <FlagPlaceholder countryCode={item.country} />}
          <Avatar className={`h-10 w-10 ${item.rank === 1 ? 'border-2 border-accent-foreground/50' : 'border-2 border-primary/50'}`}>
            <AvatarImage src={item.avatarUrl} alt={item.name} data-ai-hint="avatar logo" />
            <AvatarFallback className={`${item.rank === 1 ? 'bg-accent-foreground text-accent' : 'bg-primary text-primary-foreground'}`}>{item.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={`flex-grow font-semibold text-lg truncate ${item.rank === 1 ? 'text-accent-foreground' : 'text-card-foreground'}`}>{item.name}</span>
          {type === 'player' && item.level && <span className={`text-sm px-2 py-1 rounded-full ${item.rank === 1 ? 'bg-accent-foreground/20 text-accent-foreground' : 'bg-primary/10 text-primary'}`}>Lvl {item.level}</span>}
          <span className={`font-black text-xl tracking-tighter ${item.rank === 1 ? 'text-accent-foreground' : 'text-primary'}`}>{item.points.toLocaleString()} XP</span>
        </div>
      ))}
    </div>
  );
};

export default function LeaderboardsPage() {
  const [period, setPeriod] = useState("all-time");
  const [region, setRegion] = useState("world");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTab, setCurrentTab] = useState<'players' | 'teams' | 'countries'>("players");

  const [playerLeaderboardData, setPlayerLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [teamLeaderboardData, setTeamLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [countryLeaderboardData, setCountryLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const storedUsersJson = localStorage.getItem(ADMIN_MANAGED_USERS_KEY);
    const storedTeamsJson = localStorage.getItem(TEAMS_STORAGE_KEY);

    let allUsers: UserType[] = [];
    if (storedUsersJson) {
      try {
        allUsers = JSON.parse(storedUsersJson);
      } catch (e) { console.error("Failed to parse users from localStorage", e); }
    }

    let allTeams: TeamType[] = [];
    if (storedTeamsJson) {
      try {
        allTeams = JSON.parse(storedTeamsJson);
      } catch (e) { console.error("Failed to parse teams from localStorage", e); }
    }

    // Process Player Leaderboard
    const players = allUsers.filter(u => u.role === 'player');
    const newPlayerLeaderboard = players
      .sort((a, b) => b.points - a.points)
      .map((user, index): LeaderboardItem => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl || `https://placehold.co/40x40.png?text=${user.name.substring(0,1)}`,
        points: user.points,
        rank: index + 1,
        country: user.country,
        level: user.level,
        rankChange: 'same', // Simplified
      }));
    setPlayerLeaderboardData(newPlayerLeaderboard);

    // Process Team Leaderboard
    const newTeamLeaderboard = allTeams
      .map(team => ({
        ...team,
        // Ensure points are calculated if not already correctly stored by creation/join logic
        points: team.members.reduce((sum, member) => {
            // Find full member details from allUsers if members array only contains IDs
            const fullMember = allUsers.find(u => u.id === (typeof member === 'string' ? member : member.id));
            return sum + (fullMember?.points || 0);
        }, 0)
      }))
      .sort((a, b) => b.points - a.points)
      .map((team, index): LeaderboardItem => ({
        id: team.id,
        name: team.name,
        avatarUrl: team.avatarUrl || `https://placehold.co/40x40.png?text=${team.name.substring(0,1)}`,
        points: team.points,
        rank: index + 1,
        rankChange: 'same', // Simplified
      }));
    setTeamLeaderboardData(newTeamLeaderboard);

    // Process Country Leaderboard
    const countryPoints: { [country: string]: { points: number, players: number } } = {};
    players.forEach(user => {
      const country = user.country || "Unknown";
      if (!countryPoints[country]) {
        countryPoints[country] = { points: 0, players: 0 };
      }
      countryPoints[country].points += user.points;
      countryPoints[country].players++;
    });

    const newCountryLeaderboard = Object.entries(countryPoints)
      .map(([name, data]): LeaderboardItem => ({
        id: name,
        name,
        avatarUrl: `https://placehold.co/40x40.png?text=${name.substring(0,2).toUpperCase()}`,
        points: data.points,
        rank: 0, // Will be set after sorting
        country: name,
        rankChange: 'same', // Simplified
      }))
      .sort((a, b) => b.points - a.points)
      .map((country, index) => ({ ...country, rank: index + 1 }));
    setCountryLeaderboardData(newCountryLeaderboard);
    
    setIsLoading(false);
  }, []); // Runs once on mount

  const type = currentTab === 'players' ? 'player' : currentTab === 'teams' ? 'team' : 'country';

  const displayedData = useMemo(() => {
    let dataToDisplay: LeaderboardItem[];
    if (currentTab === 'players') dataToDisplay = playerLeaderboardData;
    else if (currentTab === 'teams') dataToDisplay = teamLeaderboardData;
    else dataToDisplay = countryLeaderboardData;

    return dataToDisplay.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (type === 'country' || type === 'team' || region === "world" || (p.country && p.country.toLowerCase() === region.toLowerCase())) 
    ).sort((a,b) => b.points - a.points).map((item, idx) => ({...item, rank: idx + 1})); // Re-rank after filter
  }, [searchTerm, region, currentTab, playerLeaderboardData, teamLeaderboardData, countryLeaderboardData, type]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Trophy className="h-16 w-16 animate-pulse text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading leaderboards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-2xl bg-card/50 border-2 border-primary/30 backdrop-blur-sm">
        <CardHeader className="text-center py-8">
          <Trophy className="h-20 w-20 mx-auto text-accent mb-4" />
          <CardTitle className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 drop-shadow-lg uppercase">
            World Champions
          </CardTitle>
          <CardDescription className="text-xl text-muted-foreground mt-2">
            See who's dominating the courts globally and locally.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'players' | 'teams' | 'countries')} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex h-auto p-1 rounded-lg bg-primary/20 backdrop-blur-sm">
          <TabsTrigger value="players" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold"><Users className="h-5 w-5 mr-2"/>Players</TabsTrigger>
          <TabsTrigger value="teams" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold"><Globe className="h-5 w-5 mr-2"/>Teams</TabsTrigger>
          <TabsTrigger value="countries" className="text-base py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl font-semibold"><Globe className="h-5 w-5 mr-2"/>Countries</TabsTrigger>
        </TabsList>

        <div className="my-6 p-4 bg-card/50 border border-primary/20 rounded-lg shadow-lg flex flex-col md:flex-row gap-4 items-center backdrop-blur-sm">
            <div className="flex-1 w-full md:w-auto">
                <Input 
                    type="search" 
                    placeholder="Search..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 text-base bg-background/70 border-primary/50 focus:bg-background"
                />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-full md:w-[180px] h-11 text-base bg-background/70 border-primary/50 focus:bg-background">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="all-time">All-Time</SelectItem>
                    </SelectContent>
                </Select>
                {currentTab !== 'teams' && (
                  <Select value={region} onValueChange={setRegion}>
                      <SelectTrigger className="w-full md:w-[180px] h-11 text-base bg-background/70 border-primary/50 focus:bg-background">
                          <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="world">World</SelectItem>
                          <SelectItem value="Asia">Asia</SelectItem>
                          <SelectItem value="Europe">Europe</SelectItem>
                          {/* Dynamically generate country options based on available data if desired */}
                          {Array.from(new Set(playerLeaderboardData.map(p => p.country).filter(Boolean))).map(c => (
                            <SelectItem key={c} value={c!}>{c}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                )}
            </div>
             <Button variant="outline" className="h-11 text-base btn-game border-primary/50 text-primary-foreground hover:text-primary-foreground focus:text-primary-foreground">
                <Filter className="mr-2 h-4 w-4" /> Filters
            </Button>
        </div>
        
        <TabsContent value="players">
            <LeaderboardListComponent data={displayedData} type="player" />
        </TabsContent>
        <TabsContent value="teams">
            <LeaderboardListComponent data={displayedData} type="team" />
        </TabsContent>
        <TabsContent value="countries">
            <LeaderboardListComponent data={displayedData} type="country" />
        </TabsContent>
      </Tabs>
    </div>
  );
}


    