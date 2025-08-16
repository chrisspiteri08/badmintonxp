
"use client";
import { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Edit3, Trash2, Puzzle, Users, CalendarCheck2, Zap, Clock, ListChecks, CheckSquare, Trophy, UploadCloud, Swords } from "lucide-react";
// DUMMY_CHALLENGES import removed
import type { Challenge, ChallengeType, QuizQuestion, PredictionOption as PredictionOptionType, QuizOption, Tournament } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, formatISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


const LOCAL_STORAGE_CHALLENGES_KEY = 'adminChallenges';
const LOCAL_STORAGE_TOURNAMENTS_KEY = 'adminTournaments';


const ChallengeIcon = ({ type }: { type: ChallengeType }) => {
  if (type === 'quiz') return <Puzzle className="h-5 w-5 text-blue-500" />;
  if (type === 'social') return <Users className="h-5 w-5 text-green-500" />;
  if (type === 'prediction') return <CalendarCheck2 className="h-5 w-5 text-purple-500" />;
  return <Zap className="h-5 w-5 text-gray-500" />;
};

const initialNewChallengeState: Omit<Challenge, 'id' | 'correctPredictionOptionId'> & { questions: QuizQuestion[], predictionOptions: PredictionOptionType[], tournamentIds: string[] } = {
  title: '',
  description: '',
  type: 'quiz',
  pointsValue: 0,
  participationPoints: 0,
  status: 'active',
  expiryDate: '',
  imageUrl: '',
  questions: [],
  predictionOptions: [],
  tournamentIds: [],
};

const initialQuizQuestionState: Omit<QuizQuestion, 'id'> = {
  questionText: '',
  options: [],
  correctOptionId: '',
  points: 10,
  isBonus: false,
  imageUrl: '',
  youtubeVideoId: '',
};

interface BulkQuizQuestion {
  questionText: string;
  options: string[];
  correctOptionText: string;
  points: number;
  isBonus?: boolean;
  imageUrl?: string;
  youtubeVideoId?: string;
}


export default function AdminChallengesPage() {
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<Tournament[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEditChallengeDialog, setShowAddEditChallengeDialog] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  
  const [newChallengeData, setNewChallengeData] = useState<typeof initialNewChallengeState>({...initialNewChallengeState, questions: [], predictionOptions: [], tournamentIds: []});
  
  const [currentQuestion, setCurrentQuestion] = useState<Omit<QuizQuestion, 'id'>>({...initialQuizQuestionState, options: []});
  const [currentQuizOptionText, setCurrentQuizOptionText] = useState('');
  const [bulkQuestionsJson, setBulkQuestionsJson] = useState('');

  const [currentPredictionOptionText, setCurrentPredictionOptionText] = useState('');

  const [isMounted, setIsMounted] = useState(false);

  const [showResolvePredictionDialog, setShowResolvePredictionDialog] = useState(false);
  const [challengeToResolve, setChallengeToResolve] = useState<Challenge | null>(null);
  const [selectedCorrectPredictionId, setSelectedCorrectPredictionId] = useState<string | null>(null);


  useEffect(() => {
    setIsMounted(true);
    const storedChallenges = localStorage.getItem(LOCAL_STORAGE_CHALLENGES_KEY);
    if (storedChallenges) {
      try {
        const parsedChallenges = JSON.parse(storedChallenges);
        const validatedChallenges = parsedChallenges.map((ch: Challenge) => ({
          ...ch,
          questions: Array.isArray(ch.questions) ? ch.questions : [],
          predictionOptions: Array.isArray(ch.predictionOptions) ? ch.predictionOptions : [],
          participationPoints: ch.participationPoints || 0,
          tournamentIds: Array.isArray(ch.tournamentIds) ? ch.tournamentIds : [],
        }));
        setChallenges(validatedChallenges);
      } catch (e) {
        console.error("Failed to parse challenges from localStorage", e);
        setChallenges([]); // Fallback to empty array
        localStorage.removeItem(LOCAL_STORAGE_CHALLENGES_KEY); 
      }
    } else {
      setChallenges([]); // Fallback to empty array
    }

    const storedTournaments = localStorage.getItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
    if (storedTournaments) {
        try {
            setAvailableTournaments(JSON.parse(storedTournaments));
        } catch (e) {
            console.error("Failed to parse tournaments from localStorage for challenge admin", e);
            setAvailableTournaments([]);
        }
    } else {
        setAvailableTournaments([]);
    }

  }, [isMounted]);

  useEffect(() => {
    if (isMounted && challenges.length > 0) { 
      localStorage.setItem(LOCAL_STORAGE_CHALLENGES_KEY, JSON.stringify(challenges));
    } else if (isMounted && challenges.length === 0) {
      localStorage.removeItem(LOCAL_STORAGE_CHALLENGES_KEY); 
    }
  }, [challenges, isMounted]);


  const filteredChallenges = useMemo(() => {
    return challenges.filter(challenge =>
      challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      challenge.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [challenges, searchTerm]);
  
  const handleDeleteChallenge = (challengeId: string) => {
    const challengeToDelete = challenges.find(c => c.id === challengeId);
    if (!challengeToDelete) return;

    setChallenges(prevChallenges => prevChallenges.filter(c => c.id !== challengeId));

    // Also update tournaments to remove this challenge ID from their lists
    let allTournaments: Tournament[] = [];
    const storedTournaments = localStorage.getItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
    if (storedTournaments) {
        try { allTournaments = JSON.parse(storedTournaments); } catch (e) { console.error("Failed to parse tournaments for update:", e); }
    }

    const updatedAllTournaments = allTournaments.map(tourn => {
        if ((tourn.challengeIds || []).includes(challengeId)) {
            return {
                ...tourn,
                challengeIds: (tourn.challengeIds || []).filter(cid => cid !== challengeId)
            };
        }
        return tourn;
    });
    localStorage.setItem(LOCAL_STORAGE_TOURNAMENTS_KEY, JSON.stringify(updatedAllTournaments));
    setAvailableTournaments(updatedAllTournaments); // Refresh local state for checkboxes

    toast({ title: "Challenge Deleted", description: `Challenge "${challengeToDelete.title}" has been removed.` });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Invalid Date';
      return format(date, 'PPp'); 
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return 'Invalid Date String';
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewChallengeData(prev => ({ ...prev, [name]: name === 'pointsValue' || name === 'participationPoints' ? parseInt(value, 10) || 0 : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setNewChallengeData(prev => ({ ...prev, [name]: value as ChallengeType | Challenge['status'] }));
  };
  
  const handleDateTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; 
    try {
        if (value) {
            const dateObject = new Date(value); 
            if (isValid(dateObject)) {
                const isoString = formatISO(dateObject); 
                setNewChallengeData(prev => ({ ...prev, [name]: isoString }));
            } else {
                 setNewChallengeData(prev => ({ ...prev, [name]: '' })); 
            }
        } else {
            setNewChallengeData(prev => ({ ...prev, [name]: '' }));
        }
    } catch (error) {
        console.error("Invalid date-time:", value, error);
        setNewChallengeData(prev => ({ ...prev, [name]: '' })); 
    }
  };

  const handleCurrentQuestionChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
     setCurrentQuestion(prev => {
      const newCurrentQuestion = { ...prev };
      if (type === 'checkbox') {
        newCurrentQuestion[name as keyof typeof newCurrentQuestion] = checked as any;
      } else if (name === 'points') {
        newCurrentQuestion.points = parseInt(value) || 0;
      } else {
        newCurrentQuestion[name as keyof Omit<QuizQuestion, 'id' | 'points' | 'isBonus' | 'options' | 'correctOptionId'>] = value;
      }
      return newCurrentQuestion;
    });
  };

  const handleAddQuizOption = () => {
    if (!currentQuizOptionText.trim()) return;
    const newOption: QuizOption = { id: `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`, text: currentQuizOptionText };
    setCurrentQuestion(prev => {
      const updatedOptions = Array.isArray(prev.options) ? [...prev.options, newOption] : [newOption];
      return { ...prev, options: updatedOptions };
    });
    setCurrentQuizOptionText('');
  };

  const handleRemoveQuizOption = (optionId: string) => {
    setCurrentQuestion(prev => {
      const updatedOptions = (prev.options || []).filter(opt => opt.id !== optionId);
      return {
        ...prev,
        options: updatedOptions,
        correctOptionId: prev.correctOptionId === optionId ? '' : prev.correctOptionId,
      };
    });
  };
  
  const handleSetCorrectQuizOption = (optionId: string) => {
    setCurrentQuestion(prev => ({ ...prev, correctOptionId: optionId }));
  };

  const handleAddQuestionToChallenge = () => {
    if (!currentQuestion.questionText.trim() || (currentQuestion.options || []).length < 2 || !currentQuestion.correctOptionId) {
      toast({ title: "Incomplete Question", description: "Question text, at least two options, and a correct answer are required.", variant: "destructive" });
      return;
    }
    const newQuestionWithId: QuizQuestion = { ...currentQuestion, id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    
    setNewChallengeData(prevData => {
        const questions = Array.isArray(prevData.questions) ? prevData.questions : [];
        const updatedQuestions = [...questions, newQuestionWithId];
        return { ...prevData, questions: updatedQuestions };
    });
    setCurrentQuestion({...initialQuizQuestionState, options: []}); 
    setCurrentQuizOptionText('');
  };

  const handleRemoveQuestionFromChallenge = (questionId: string) => {
    setNewChallengeData(prevData => {
      const questions = Array.isArray(prevData.questions) ? prevData.questions : [];
      const updatedQuestions = questions.filter(q => q.id !== questionId);
      return { ...prevData, questions: updatedQuestions };
    });
  };

  const handleBulkUploadQuestions = () => {
    if (!bulkQuestionsJson.trim()) {
      toast({ title: "Error", description: "JSON input is empty.", variant: "destructive" });
      return;
    }
    
    let jsonToParse = bulkQuestionsJson.trim();
    if (jsonToParse.startsWith('\\') && (jsonToParse.charAt(1) === '[' || jsonToParse.charAt(1) === '{')) {
      jsonToParse = jsonToParse.substring(1);
    }

    try {
      const parsedQuestions: BulkQuizQuestion[] = JSON.parse(jsonToParse);
      if (!Array.isArray(parsedQuestions)) {
        throw new Error("JSON must be an array of questions.");
      }

      const newQuizQuestions: QuizQuestion[] = [];
      let questionsAddedCount = 0;
      let questionsSkippedCount = 0;

      for (const qData of parsedQuestions) {
        if (!qData.questionText || !Array.isArray(qData.options) || qData.options.length < 2 || !qData.correctOptionText || typeof qData.points !== 'number') {
          questionsSkippedCount++;
          console.warn("Skipping invalid question data:", qData);
          continue;
        }

        const options: QuizOption[] = qData.options.map(optText => ({
          id: `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          text: optText,
        }));

        const correctOption = options.find(opt => opt.text === qData.correctOptionText);
        if (!correctOption) {
          questionsSkippedCount++;
          console.warn("Skipping question due to missing correct option text match:", qData);
          continue;
        }

        newQuizQuestions.push({
          id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          questionText: qData.questionText,
          options: options,
          correctOptionId: correctOption.id,
          points: qData.points,
          isBonus: qData.isBonus || false,
          imageUrl: qData.imageUrl || '',
          youtubeVideoId: qData.youtubeVideoId || '',
        });
        questionsAddedCount++;
      }

      if (questionsAddedCount > 0) {
        setNewChallengeData(prevData => ({
          ...prevData,
          questions: [...(Array.isArray(prevData.questions) ? prevData.questions : []), ...newQuizQuestions],
        }));
        toast({ title: "Bulk Upload Success", description: `${questionsAddedCount} questions added.` });
      }
      if (questionsSkippedCount > 0) {
         toast({ title: "Bulk Upload Notice", description: `${questionsSkippedCount} questions were skipped due to errors or missing data. Check console for details.`, variant: "default", duration: 7000 });
      }
      if (questionsAddedCount === 0 && questionsSkippedCount === 0 && parsedQuestions.length > 0) {
         toast({ title: "Bulk Upload", description: "No valid questions found in JSON.", variant: "destructive" });
      }


      setBulkQuestionsJson(''); 

    } catch (error) {
      toast({ title: "JSON Parsing Error", description: (error as Error).message || "Invalid JSON format.", variant: "destructive" });
      console.error("JSON Parsing Error:", error);
    }
  };
  
  const handleAddPredictionOptionToChallenge = () => {
    if (!currentPredictionOptionText.trim()) return;
    const newOption: PredictionOptionType = { id: `pred-opt-${Date.now()}-${Math.random().toString(16).slice(2)}`, text: currentPredictionOptionText };
    setNewChallengeData(prevData => {
        const predictionOptions = Array.isArray(prevData.predictionOptions) ? prevData.predictionOptions : [];
        const updatedOptions = [...predictionOptions, newOption];
        return { ...prevData, predictionOptions: updatedOptions };
    });
    setCurrentPredictionOptionText('');
  };

  const handleRemovePredictionOptionFromChallenge = (optionId: string) => {
      setNewChallengeData(prevData => {
          const predictionOptions = Array.isArray(prevData.predictionOptions) ? prevData.predictionOptions : [];
          const updatedOptions = predictionOptions.filter(opt => opt.id !== optionId);
          return { ...prevData, predictionOptions: updatedOptions };
      });
  };

  const handleOpenEditDialog = (challenge: Challenge) => {
    setEditingChallengeId(challenge.id);
    const questions = (Array.isArray(challenge.questions) ? challenge.questions : []).map(q => ({...q, options: Array.isArray(q.options) ? [...q.options] : []}));
    const predictionOptions = Array.isArray(challenge.predictionOptions) ? [...challenge.predictionOptions] : [];
    const tournamentIds = Array.isArray(challenge.tournamentIds) ? [...challenge.tournamentIds] : [];

    setNewChallengeData({
      title: challenge.title,
      description: challenge.description,
      type: challenge.type,
      pointsValue: challenge.pointsValue,
      participationPoints: challenge.participationPoints || 0,
      status: challenge.status,
      expiryDate: challenge.expiryDate || '',
      imageUrl: challenge.imageUrl || '',
      questions: questions,
      predictionOptions: predictionOptions,
      tournamentIds: tournamentIds,
    });
    setShowAddEditChallengeDialog(true);
  };


  const handleChallengeFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newChallengeData.title || !newChallengeData.type) {
      toast({ title: "Error", description: "Title and Type are required.", variant: "destructive" });
      return;
    }
    
    const currentQuestions = Array.isArray(newChallengeData.questions) ? newChallengeData.questions : [];
    const currentPredictionOptions = Array.isArray(newChallengeData.predictionOptions) ? newChallengeData.predictionOptions : [];
    const currentTournamentIds = Array.isArray(newChallengeData.tournamentIds) ? newChallengeData.tournamentIds : [];


    if (newChallengeData.type === 'quiz' && currentQuestions.length === 0) {
        toast({ title: "Error", description: "Quiz challenges must have at least one question.", variant: "destructive" });
        return;
    }
    if (newChallengeData.type === 'prediction' && currentPredictionOptions.length < 2) {
        toast({ title: "Error", description: "Prediction challenges must have at least two options.", variant: "destructive" });
        return;
    }


    let finalPointsValue = newChallengeData.pointsValue;
    if (newChallengeData.type === 'quiz' && currentQuestions.length > 0) {
      finalPointsValue = currentQuestions.reduce((sum, q) => sum + (q.isBonus ? q.points * 2 : q.points), 0);
    }

    const challengeEntryData = {
      ...newChallengeData,
      pointsValue: finalPointsValue,
      participationPoints: newChallengeData.participationPoints || 0,
      questions: newChallengeData.type === 'quiz' ? currentQuestions : [], 
      predictionOptions: newChallengeData.type === 'prediction' ? currentPredictionOptions : [],
      tournamentIds: currentTournamentIds,
      expiryDate: newChallengeData.expiryDate || '', 
    };

    let processedChallengeId: string;
    let challengeTitle: string;

    if (editingChallengeId) { 
        setChallenges(prev => prev.map(c => c.id === editingChallengeId ? { ...c, ...challengeEntryData, id: editingChallengeId, correctPredictionOptionId: c.correctPredictionOptionId } : c));
        processedChallengeId = editingChallengeId;
        challengeTitle = challengeEntryData.title;
        toast({ title: "Challenge Updated", description: `"${challengeEntryData.title}" has been updated.` });
    } else { 
        const newChallengeEntry: Challenge = {
            ...challengeEntryData,
            id: `challenge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            correctPredictionOptionId: undefined, 
        };
        setChallenges(prev => [newChallengeEntry, ...prev]);
        processedChallengeId = newChallengeEntry.id;
        challengeTitle = newChallengeEntry.title;
        toast({ title: "Challenge Added", description: `"${newChallengeEntry.title}" has been added.` });
    }
    
    // Synchronize with Tournaments
    let allTournaments: Tournament[] = [];
    const storedTournaments = localStorage.getItem(LOCAL_STORAGE_TOURNAMENTS_KEY);
    if (storedTournaments) {
        try {
            allTournaments = JSON.parse(storedTournaments);
        } catch (parseError) {
            console.error("Failed to parse tournaments for update:", parseError);
        }
    }

    let tournamentsWereModified = false;
    const updatedAllTournaments = allTournaments.map(tourn => {
        const challengeShouldBeInThisTournament = (challengeEntryData.tournamentIds || []).includes(tourn.id);
        const challengeIsCurrentlyInThisTournament = (tourn.challengeIds || []).includes(processedChallengeId);
        let newTournamentChallengeIds = [...(tourn.challengeIds || [])];

        if (challengeShouldBeInThisTournament && !challengeIsCurrentlyInThisTournament) {
            newTournamentChallengeIds.push(processedChallengeId);
            tournamentsWereModified = true;
        } else if (!challengeShouldBeInThisTournament && challengeIsCurrentlyInThisTournament) {
            newTournamentChallengeIds = newTournamentChallengeIds.filter(cid => cid !== processedChallengeId);
            tournamentsWereModified = true;
        }
        
        if (JSON.stringify(newTournamentChallengeIds) !== JSON.stringify(tourn.challengeIds || [])) {
          return { ...tourn, challengeIds: newTournamentChallengeIds };
        }
        return tourn;
    });

    if (tournamentsWereModified) {
        localStorage.setItem(LOCAL_STORAGE_TOURNAMENTS_KEY, JSON.stringify(updatedAllTournaments));
        setAvailableTournaments(updatedAllTournaments); // Refresh local state for checkboxes if needed
    }
    
    setShowAddEditChallengeDialog(false);
    resetDialogState();
  };

  const handleOpenResolveDialog = (challenge: Challenge) => {
    setChallengeToResolve(challenge);
    setSelectedCorrectPredictionId(challenge.correctPredictionOptionId || null);
    setShowResolvePredictionDialog(true);
  };

  const handleResolvePredictionSubmit = () => {
    if (!challengeToResolve || !selectedCorrectPredictionId) {
        toast({ title: "Error", description: "No winning option selected or challenge missing.", variant: "destructive" });
        return;
    }
    setChallenges(prevChallenges => 
        prevChallenges.map(c => 
            c.id === challengeToResolve.id 
            ? { ...c, correctPredictionOptionId: selectedCorrectPredictionId, status: 'completed' as Challenge['status'] } 
            : c
        )
    );
    toast({ title: "Prediction Resolved!", description: `"${challengeToResolve.title}" has been resolved.`});
    setShowResolvePredictionDialog(false);
    setChallengeToResolve(null);
    setSelectedCorrectPredictionId(null);
  };

  const resetDialogState = () => {
    setNewChallengeData({...initialNewChallengeState, questions: [], predictionOptions: [], tournamentIds: []}); 
    setCurrentQuestion({...initialQuizQuestionState, options: []}); 
    setCurrentQuizOptionText('');
    setCurrentPredictionOptionText('');
    setEditingChallengeId(null);
    setBulkQuestionsJson('');
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Puzzle className="h-8 w-8 mr-3 text-accent" /> Challenge Management
          </CardTitle>
          <CardDescription className="text-lg">
            Create, edit, and manage all challenges available to users.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                type="search" 
                placeholder="Search challenges by title or type..."
                className="pl-10 h-11 text-base w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Dialog open={showAddEditChallengeDialog} onOpenChange={(isOpen) => {
                setShowAddEditChallengeDialog(isOpen);
                if (!isOpen) { 
                    resetDialogState();
                }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetDialogState(); setShowAddEditChallengeDialog(true); }} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base py-2.5 px-5 w-full md:w-auto">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add New Challenge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{editingChallengeId ? "Edit Challenge" : "Add New Challenge"}</DialogTitle>
                  <DialogDescription>
                    {editingChallengeId ? "Modify the details for this challenge." : "Fill in the details for the new challenge."}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(80vh-200px)] pr-6"> 
                <form onSubmit={handleChallengeFormSubmit} className="grid gap-6 py-4" id="addEditChallengeForm">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right col-span-1">Title</Label>
                    <Input id="title" name="title" value={newChallengeData.title} onChange={handleInputChange} className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right col-span-1">Description</Label>
                    <Textarea id="description" name="description" value={newChallengeData.description} onChange={handleInputChange} className="col-span-3 min-h-[80px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2">
                        <Label htmlFor="type" className="text-right col-span-2 sm:col-span-1">Type</Label>
                        <Select name="type" value={newChallengeData.type} onValueChange={(value) => handleSelectChange('type', value)}>
                        <SelectTrigger className="col-span-2 sm:col-span-1">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="quiz">Quiz</SelectItem>
                            <SelectItem value="social">Social</SelectItem>
                            <SelectItem value="prediction">Prediction</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2">
                        <Label htmlFor="status" className="text-right col-span-2 sm:col-span-1">Status</Label>
                        <Select name="status" value={newChallengeData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                        <SelectTrigger className="col-span-2 sm:col-span-1">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            {editingChallengeId && newChallengeData.type === 'prediction' && <SelectItem value="completed">Completed (Resolved)</SelectItem>}
                        </SelectContent>
                        </Select>
                    </div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2 relative">
                        <Label htmlFor="pointsValue" className="text-right col-span-2 sm:col-span-1">Reward XP</Label>
                        <Input 
                            id="pointsValue" 
                            name="pointsValue" 
                            type="number" 
                            value={(newChallengeData.type === 'quiz' && Array.isArray(newChallengeData.questions) && newChallengeData.questions.length > 0) ? newChallengeData.questions.reduce((sum, q) => sum + (q.isBonus ? q.points * 2 : q.points), 0) : newChallengeData.pointsValue} 
                            onChange={handleInputChange} 
                            className="col-span-2 sm:col-span-1" 
                            min="0" 
                            disabled={newChallengeData.type === 'quiz'}
                        />
                        {newChallengeData.type === 'quiz' && (
                            <p className="absolute -bottom-4 left-0 right-0 text-xs text-muted-foreground col-span-full text-center sm:text-left sm:pl-[calc(50%+0.5rem)]">
                                Auto-calculated for quizzes.
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2">
                        <Label htmlFor="participationPoints" className="text-right col-span-2 sm:col-span-1">Participation XP</Label>
                        <Input id="participationPoints" name="participationPoints" type="number" value={newChallengeData.participationPoints || 0} onChange={handleInputChange} className="col-span-2 sm:col-span-1" min="0"/>
                    </div>
                   </div>
                  <div className="grid grid-cols-4 items-center gap-4 mt-2">
                    <Label htmlFor="expiryDate" className="text-right col-span-1">Expiry Date & Time</Label>
                    <Input id="expiryDate" name="expiryDate" type="datetime-local" 
                           value={newChallengeData.expiryDate && isValid(parseISO(newChallengeData.expiryDate)) ? format(parseISO(newChallengeData.expiryDate), "yyyy-MM-dd'T'HH:mm") : ''} 
                           onChange={handleDateTimeChange} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="imageUrl" className="text-right col-span-1">Challenge Image URL</Label>
                    <Input id="imageUrl" name="imageUrl" value={newChallengeData.imageUrl || ''} onChange={handleInputChange} className="col-span-3" placeholder="https://placehold.co/600x300.png" />
                  </div>

                  {newChallengeData.type === 'quiz' && (
                    <div className="col-span-full space-y-6 border-t border-border pt-6 mt-4">
                        <div className="space-y-3">
                            <Label htmlFor="bulkQuestionsJson" className="text-lg font-semibold text-primary flex items-center">
                                <UploadCloud className="mr-2 h-5 w-5"/> Bulk Upload Questions (JSON)
                            </Label>
                            <Textarea
                                id="bulkQuestionsJson"
                                value={bulkQuestionsJson}
                                onChange={(e) => setBulkQuestionsJson(e.target.value)}
                                placeholder='Paste JSON array of questions here. Example: [{"questionText": "Q1?", "options": ["A", "B"], "correctOptionText": "A", "points": 10}]'
                                className="min-h-[120px] text-xs font-mono"
                            />
                            <Button type="button" onClick={handleBulkUploadQuestions} variant="outline" size="sm" className="w-full">
                                Process JSON & Add Questions
                            </Button>
                             <p className="text-xs text-muted-foreground">Manually add questions below or use bulk upload. Added questions will appear at the bottom.</p>
                        </div>

                        <div className="p-4 border rounded-md space-y-4 bg-muted/30">
                            <h4 className="text-md font-medium">Add New Question Details</h4>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="questionText" className="text-right col-span-1">Question Text</Label>
                                <Textarea id="questionText" name="questionText" value={currentQuestion.questionText} onChange={handleCurrentQuestionChange} className="col-span-3 min-h-[60px]" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="qImageUrl" className="text-right col-span-1">Image URL (Opt.)</Label>
                                <Input id="qImageUrl" name="imageUrl" value={currentQuestion.imageUrl || ''} onChange={handleCurrentQuestionChange} className="col-span-3" placeholder="https://placehold.co/400x200.png" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="qYoutubeVideoId" className="text-right col-span-1">YouTube ID (Opt.)</Label>
                                <Input id="qYoutubeVideoId" name="youtubeVideoId" value={currentQuestion.youtubeVideoId || ''} onChange={handleCurrentQuestionChange} className="col-span-3" placeholder="dQw4w9WgXcQ" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="qPoints" className="text-right col-span-1">Points</Label>
                                <Input id="qPoints" name="points" type="number" value={currentQuestion.points} onChange={handleCurrentQuestionChange} className="col-span-1" min="0"/>
                                <div className="col-span-2 flex items-center gap-2 pl-2">
                                    <Checkbox id="qIsBonus" name="isBonus" checked={currentQuestion.isBonus} onCheckedChange={(checked) => setCurrentQuestion(prev => ({...prev, isBonus: !!checked}))} />
                                    <Label htmlFor="qIsBonus">Is Bonus Question?</Label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-medium">Options (Min. 2, Max. 4 Recommended)</Label>
                                {(currentQuestion.options || []).map((opt) => (
                                <div key={opt.id} className="flex items-center gap-2">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleSetCorrectQuizOption(opt.id)} className={cn(currentQuestion.correctOptionId === opt.id ? "text-green-500 hover:text-green-600" : "text-muted-foreground hover:text-foreground")}>
                                        <CheckSquare className="h-5 w-5"/>
                                    </Button>
                                    <Input value={opt.text} readOnly className="flex-grow bg-background/50"/>
                                    <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveQuizOption(opt.id)}>
                                    <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                ))}
                                <div className="flex items-center gap-2 pt-1">
                                <Input value={currentQuizOptionText} onChange={(e) => setCurrentQuizOptionText(e.target.value)} placeholder="New quiz option text" className="flex-grow"/>
                                <Button type="button" onClick={handleAddQuizOption} variant="outline" size="sm">
                                    <PlusCircle className="mr-1.5 h-4 w-4"/>Add Quiz Option
                                </Button>
                                </div>
                                {(currentQuestion.options || []).length > 0 && !currentQuestion.correctOptionId && (
                                    <p className="text-xs text-destructive">Please select a correct quiz option by clicking the checkbox icon.</p>
                                )}
                            </div>
                            <Button type="button" onClick={handleAddQuestionToChallenge} className="w-full btn-game mt-2">Add This Question to Challenge</Button>
                        </div>

                        {Array.isArray(newChallengeData.questions) && newChallengeData.questions.length > 0 && (
                            <div className="space-y-3 mt-4">
                            <h4 className="text-md font-medium">Added Questions:</h4>
                            {newChallengeData.questions.map((q, idx) => (
                                <Card key={q.id} className="p-3 bg-card/70">
                                <div className="flex justify-between items-start">
                                    <div>
                                    <p className="font-semibold text-sm">{idx + 1}. {q.questionText} ({q.points} XP{q.isBonus ? ", Bonus" : ""})</p>
                                    <p className="text-xs text-muted-foreground">Options: {(q.options || []).length}, Correct: {(q.options || []).find(o=>o.id === q.correctOptionId)?.text || 'N/A'}</p>
                                    {q.imageUrl && <p className="text-xs text-blue-400 truncate max-w-xs">Image: {q.imageUrl}</p>}
                                    {q.youtubeVideoId && <p className="text-xs text-red-400">Video: {q.youtubeVideoId}</p>}
                                    </div>
                                    <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveQuestionFromChallenge(q.id)}>
                                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                                    </Button>
                                </div>
                                </Card>
                            ))}
                            </div>
                        )}
                    </div>
                  )}

                  {newChallengeData.type === 'prediction' && (
                    <div className="col-span-full space-y-6 border-t border-border pt-6 mt-4">
                      <h3 className="text-lg font-semibold text-primary flex items-center"><CalendarCheck2 className="mr-2 h-5 w-5"/>Prediction Options</h3>
                      <div className="p-4 border rounded-md space-y-4 bg-muted/30">
                        <div className="flex items-center gap-2 pt-1">
                            <Input value={currentPredictionOptionText} onChange={(e) => setCurrentPredictionOptionText(e.target.value)} placeholder="New prediction option text" className="flex-grow"/>
                            <Button type="button" onClick={handleAddPredictionOptionToChallenge} variant="outline" size="sm" disabled={(newChallengeData.predictionOptions || []).length >= 5}>
                                <PlusCircle className="mr-1.5 h-4 w-4"/>Add Prediction Option
                            </Button>
                        </div>
                        {(newChallengeData.predictionOptions || []).length >= 5 && <p className="text-xs text-muted-foreground">Maximum of 5 prediction options allowed.</p>}

                        {Array.isArray(newChallengeData.predictionOptions) && newChallengeData.predictionOptions.length > 0 && (
                            <div className="space-y-2 mt-2">
                                <h4 className="text-md font-medium">Current Options:</h4>
                                {newChallengeData.predictionOptions.map((opt, idx) => (
                                <Card key={opt.id} className="p-2 bg-card/70">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm">{idx + 1}. {opt.text}</p>
                                        <Button type="button" variant="destructive" size="icon-sm" onClick={() => handleRemovePredictionOptionFromChallenge(opt.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </Card>
                                ))}
                            </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="col-span-full space-y-2 border-t border-border pt-4 mt-4">
                    <Label className="text-base font-medium flex items-center">
                        <Swords className="mr-2 h-5 w-5 text-primary"/> Assign to Tournaments (Optional)
                    </Label>
                    {availableTournaments.length > 0 ? (
                        <ScrollArea className="h-32 rounded-md border p-2 bg-muted/30">
                        {availableTournaments.map(tournament => (
                            <div key={tournament.id} className="flex items-center space-x-2 py-1.5">
                            <Checkbox
                                id={`tour-${tournament.id}`}
                                checked={newChallengeData.tournamentIds?.includes(tournament.id)}
                                onCheckedChange={(checked) => {
                                const currentTournamentIds = newChallengeData.tournamentIds || [];
                                if (checked) {
                                    setNewChallengeData(prev => ({ ...prev, tournamentIds: [...currentTournamentIds, tournament.id] }));
                                } else {
                                    setNewChallengeData(prev => ({ ...prev, tournamentIds: currentTournamentIds.filter(id => id !== tournament.id) }));
                                }
                                }}
                            />
                            <Label htmlFor={`tour-${tournament.id}`} className="text-sm font-normal cursor-pointer">
                                {tournament.name}
                            </Label>
                            </div>
                        ))}
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground p-2 border rounded-md">
                        No tournaments available. Create tournaments first in the Tournament Management section.
                        </p>
                    )}
                  </div>
                </form>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t"> 
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" form="addEditChallengeForm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        {editingChallengeId ? "Save Changes" : "Add Challenge"}
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
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="text-right">Part. XP</TableHead>
                <TableHead className="text-right">Reward XP</TableHead>
                <TableHead className="text-center w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChallenges.map((challenge) => (
                <TableRow key={challenge.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2 capitalize">
                        <ChallengeIcon type={challenge.type} />
                        {challenge.type}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{challenge.title}</TableCell>
                  <TableCell>
                     <Badge variant={challenge.status === 'active' ? 'default' : challenge.status === 'completed' ? 'secondary' : 'outline'} 
                       className={`capitalize ${challenge.status === 'active' ? 'bg-accent text-accent-foreground' : challenge.status === 'completed' ? 'bg-green-500 text-white' : challenge.status === 'expired' ? 'bg-gray-400 text-white' : '' }`}>
                        {challenge.status}
                    </Badge>
                    {challenge.type === 'prediction' && challenge.correctPredictionOptionId && (
                        <Badge variant="outline" className="ml-2 border-blue-500 text-blue-500">Resolved</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatDate(challenge.expiryDate)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{challenge.participationPoints ?? 0} XP</TableCell>
                  <TableCell className="text-right">{challenge.pointsValue} XP</TableCell>
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
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(challenge)}> 
                            <Edit3 className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {challenge.type === 'prediction' && challenge.status === 'active' && !challenge.correctPredictionOptionId && (
                            <DropdownMenuItem onClick={() => handleOpenResolveDialog(challenge)}>
                                <Trophy className="mr-2 h-4 w-4 text-green-500" /> Resolve Prediction
                            </DropdownMenuItem>
                          )}
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
                            This action will permanently delete the challenge "{challenge.title}". This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteChallenge(challenge.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Yes, delete challenge
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
         {filteredChallenges.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">No challenges found matching your criteria.</div>
        )}
      </Card>

      <Dialog open={showResolvePredictionDialog} onOpenChange={(isOpen) => {
          setShowResolvePredictionDialog(isOpen);
          if (!isOpen) {
              setChallengeToResolve(null);
              setSelectedCorrectPredictionId(null);
          }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Prediction: {challengeToResolve?.title}</DialogTitle>
            <DialogDescription>Select the correct outcome for this prediction challenge. This will mark it as completed.</DialogDescription>
          </DialogHeader>
          {challengeToResolve && challengeToResolve.predictionOptions && challengeToResolve.predictionOptions.length > 0 ? (
            <div className="py-4">
              <RadioGroup 
                value={selectedCorrectPredictionId || ""} 
                onValueChange={setSelectedCorrectPredictionId}
                className="space-y-2"
              >
                {challengeToResolve.predictionOptions.map(option => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.id} id={`resolve-${option.id}`} />
                    <Label htmlFor={`resolve-${option.id}`}>{option.text}</Label>
                  </div>
                ))}
              </RadioGroup>
              {!selectedCorrectPredictionId && <p className="text-xs text-destructive mt-2">Please select a winning option.</p>}
            </div>
          ) : (
            <p className="py-4 text-muted-foreground">No prediction options available for this challenge or challenge not loaded.</p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
                type="button" 
                onClick={handleResolvePredictionSubmit} 
                disabled={!selectedCorrectPredictionId}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
                Confirm & Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
