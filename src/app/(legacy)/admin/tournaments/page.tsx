
"use client";
import { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Edit3, Trash2, Swords, CalendarDays, ListChecks, Image as ImageIcon } from "lucide-react";
import type { Tournament, Challenge } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, formatISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const LOCAL_STORAGE_TOURNAMENTS_KEY = 'adminTournaments';
const LOCAL_STORAGE_CHALLENGES_KEY = 'adminChallenges';

const initialTournamentFormData: Omit<Tournament, 'id'> = {
  name: '',
  description: '',
  endDate: '',
  challengeIds: [],
  imageUrl: '',
};

export default function AdminTournamentsPage() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showTournamentDialog, setShowTournamentDialog] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [currentTournamentFormData, setCurrentTournamentFormData] = useState<Omit<Tournament, 'id'>>({...initialTournamentFormData});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedTournaments = localStorage.getItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
    if (storedTournaments) {
      try {
        const parsedTournaments: Tournament[] = JSON.parse(storedTournaments);
        const validatedTournaments = parsedTournaments.map(t => ({
            ...t,
            challengeIds: Array.isArray(t.challengeIds) ? t.challengeIds : [],
            imageUrl: t.imageUrl || '', 
        }));
        setTournaments(validatedTournaments);
      } catch (e) {
        console.error("Failed to parse tournaments from localStorage", e);
        setTournaments([]);
      }
    } else {
      setTournaments([]);
    }

    const storedChallenges = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
    if (storedChallenges) {
      try {
        setAvailableChallenges(JSON.parse(storedChallenges));
      } catch (e) {
        console.error("Failed to parse challenges from localStorage", e);
        setAvailableChallenges([]);
      }
    } else {
      setAvailableChallenges([]);
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      if (tournaments.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_TOURNAMENTS_KEY, JSON.stringify(tournaments));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
      }
    }
  }, [tournaments, isMounted]);

  // useEffect to populate form when editingTournament changes and dialog is open
  useEffect(() => {
    if (editingTournament && showTournamentDialog) {
      setCurrentTournamentFormData({
        name: editingTournament.name,
        description: editingTournament.description,
        endDate: editingTournament.endDate,
        challengeIds: Array.isArray(editingTournament.challengeIds) ? [...editingTournament.challengeIds] : [],
        imageUrl: editingTournament.imageUrl || '',
      });
      console.log('[useEffect editingTournament] Populating form data. Challenge IDs:', Array.isArray(editingTournament.challengeIds) ? [...editingTournament.challengeIds] : []);
    } else if (!editingTournament && showTournamentDialog) {
      // This case is for "Add New" if dialog is opened without an editingTournament explicitly set to null first
      // resetDialogState() is generally preferred for "Add New"
    }
  }, [editingTournament, showTournamentDialog]);


  const filteredTournaments = useMemo(() => {
    return tournaments.filter(tournament =>
      tournament.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tournaments, searchTerm]);

  const formatDateForDisplay = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'PP') : 'Invalid Date';
    } catch (error) {
      return 'Invalid Date';
    }
  };
  
  const formatDateForInput = (isoString?: string) => {
    if (!isoString || !isValid(parseISO(isoString))) return '';
    return format(parseISO(isoString), "yyyy-MM-dd");
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentTournamentFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; 
    try {
        if (value) {
            const dateObject = parseISO(value); 
            if (isValid(dateObject)) {
                setCurrentTournamentFormData(prev => ({ ...prev, [name]: formatISO(dateObject) }));
            } else {
                 setCurrentTournamentFormData(prev => ({ ...prev, [name]: '' })); 
            }
        } else {
            setCurrentTournamentFormData(prev => ({ ...prev, [name]: '' }));
        }
    } catch (error) {
        console.error("Invalid date:", value, error);
        setCurrentTournamentFormData(prev => ({ ...prev, [name]: '' })); 
    }
  };

  const handleChallengeSelection = (challengeId: string, checked: boolean | string) => {
    setCurrentTournamentFormData(prev => {
      const currentChallengeIds = Array.isArray(prev.challengeIds) ? prev.challengeIds : [];
      if (checked) {
        return { ...prev, challengeIds: Array.from(new Set([...currentChallengeIds, challengeId])) };
      } else {
        return { ...prev, challengeIds: currentChallengeIds.filter(id => id !== challengeId) };
      }
    });
  };

  const resetDialogState = () => {
    // setEditingTournament(null); // This will be set by the caller if needed
    setCurrentTournamentFormData({...initialTournamentFormData, challengeIds: []});
  };

  const handleOpenAddDialog = () => {
    resetDialogState();
    setEditingTournament(null); // Ensure editingTournament is null for "Add New"
    setShowTournamentDialog(true);
  };

  const handleOpenEditDialog = (tournament: Tournament) => {
    setEditingTournament(tournament); // Set the tournament to be edited
    // Form data will be populated by the useEffect hook
    setShowTournamentDialog(true); // Then show the dialog
  };

  const handleTournamentFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!currentTournamentFormData.name || !currentTournamentFormData.endDate) {
      toast({ title: "Error", description: "Name and End Date are required.", variant: "destructive" });
      return;
    }
    
    const finalFormData = {
      ...currentTournamentFormData,
      challengeIds: Array.isArray(currentTournamentFormData.challengeIds) ? currentTournamentFormData.challengeIds : [],
      imageUrl: currentTournamentFormData.imageUrl || '',
    };


    if (editingTournament) {
      const updatedTournament: Tournament = { ...editingTournament, ...finalFormData };
      setTournaments(prev => prev.map(t => t.id === editingTournament.id ? updatedTournament : t));
      toast({ title: "Tournament Updated", description: `"${updatedTournament.name}" has been updated.` });
    } else {
      const newTournament: Tournament = {
        id: `tour-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...finalFormData,
      };
      setTournaments(prev => [newTournament, ...prev]);
      toast({ title: "Tournament Added", description: `"${newTournament.name}" has been added.` });
    }
    setShowTournamentDialog(false);
    resetDialogState();
    setEditingTournament(null); // Clear editing state after submit
  };

  const handleDeleteTournament = (tournamentId: string) => {
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
    toast({ title: "Tournament Deleted", description: `Tournament has been removed.` });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Swords className="h-8 w-8 mr-3 text-accent" /> Tournament Management
          </CardTitle>
          <CardDescription className="text-lg">
            Create, edit, and manage all game tournaments.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search tournaments by name..."
              className="pl-10 h-11 text-base w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={showTournamentDialog} onOpenChange={(isOpen) => {
              setShowTournamentDialog(isOpen);
              if (!isOpen) {
                resetDialogState();
                setEditingTournament(null); // Also clear editingTournament when dialog closes
              }
          }}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenAddDialog} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base py-2.5 px-5 w-full md:w-auto">
                <PlusCircle className="mr-2 h-5 w-5" /> Add New Tournament
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-2xl">{editingTournament ? "Edit Tournament" : "Add New Tournament"}</DialogTitle>
                <DialogDescription>
                  {editingTournament ? "Modify details for this tournament." : "Fill in details for the new tournament."}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(70vh-100px)] pr-6">
                <form 
                    key={editingTournament ? editingTournament.id : 'new-tournament-form'} 
                    onSubmit={handleTournamentFormSubmit} 
                    className="grid gap-6 py-4" 
                    id="tournamentDialogForm"
                >
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right col-span-1">Name</Label>
                    <Input id="name" name="name" value={currentTournamentFormData.name} onChange={handleInputChange} className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right col-span-1 pt-2">Description</Label>
                    <Textarea id="description" name="description" value={currentTournamentFormData.description} onChange={handleInputChange} className="col-span-3 min-h-[80px]" />
                  </div>
                  <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input id="endDate" name="endDate" type="date" value={formatDateForInput(currentTournamentFormData.endDate)} onChange={handleDateChange} required />
                  </div>
                  <div>
                    <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                    <Input id="imageUrl" name="imageUrl" value={currentTournamentFormData.imageUrl || ''} onChange={handleInputChange} placeholder="https://placehold.co/600x300.png" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-base font-medium flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/> Select Challenges</Label>
                    {
                      console.log('[AdminTournamentsDialog Render] currentTournamentFormData.challengeIds:', currentTournamentFormData.challengeIds)
                    }
                    {availableChallenges.length > 0 ? (
                      <ScrollArea className="h-40 rounded-md border p-2 bg-muted/30">
                        {availableChallenges.map(challenge => {
                          const currentFormIds = Array.isArray(currentTournamentFormData.challengeIds) ? currentTournamentFormData.challengeIds : [];
                          const isCurrentlyChecked = currentFormIds.includes(challenge.id);
                          // console.log(`[AdminTournamentsDialog Checkbox] Challenge: "${challenge.title}" (ID: ${challenge.id}), currentTournamentFormData.challengeIds: ${JSON.stringify(currentFormIds)}, isCurrentlyChecked: ${isCurrentlyChecked}`);
                          return (
                            <div key={challenge.id} className="flex items-center space-x-2 py-1.5">
                              <Checkbox
                                id={`challenge-${challenge.id}`}
                                checked={isCurrentlyChecked}
                                onCheckedChange={(checked) => handleChallengeSelection(challenge.id, checked)}
                              />
                              <Label htmlFor={`challenge-${challenge.id}`} className="text-sm font-normal cursor-pointer">
                                {challenge.title} <span className="text-xs text-muted-foreground">({challenge.type}, {challenge.pointsValue}XP)</span>
                              </Label>
                            </div>
                          );
                        })}
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground p-2 border rounded-md">No challenges available to select. Please add challenges first in the Challenge Management section.</p>
                    )}
                  </div>
                </form>
              </ScrollArea>
              <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" form="tournamentDialogForm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {editingTournament ? "Save Changes" : "Add Tournament"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tournament Name</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-center">Challenges</TableHead>
                <TableHead className="text-center w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTournaments.map((tournament) => (
                <TableRow key={tournament.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{tournament.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      {formatDateForDisplay(tournament.endDate)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{(Array.isArray(tournament.challengeIds) ? tournament.challengeIds : []).length}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(tournament)}><Edit3 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This action will permanently delete the tournament "{tournament.name}".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTournament(tournament.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Yes, delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {filteredTournaments.length === 0 && (
          <div className="text-center p-8 text-muted-foreground">No tournaments found matching your criteria or no tournaments created yet.</div>
        )}
      </Card>
    </div>
  );
}

