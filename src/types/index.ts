
import type { LucideIcon } from 'lucide-react';

export interface User { // This primarily represents data from your public 'profiles' table
  id: string; // UUID from Supabase auth.users
  name: string; 
  firstName?: string;
  lastName?: string;
  email: string; // From Supabase auth.users
  // password field removed, Supabase Auth handles this
  avatarUrl?: string;
  points: number;
  level: number;
  country?: string;
  continent?: string;
  teamId?: string | null; // UUID of the team
  role: 'player' | 'admin';
  referralCode?: string;
  mobile?: string;
  favouritePlayer?: string;
  agreedToTerms: boolean; // Should be not null
  created_at?: string; // ISO date string
  updated_at?: string; // ISO date string
}

export interface Team {
  id: string; // UUID
  name: string;
  avatarUrl?: string;
  members?: User[]; // Typically fetched separately or via a view/join
  points: number; // Sum of member points, or managed directly
  captainId?: string; // UUID of the user/profile
  description?: string; 
  created_at?: string;
  updated_at?: string;
}

export type ChallengeType = 'social' | 'quiz' | 'prediction';

export interface QuizOption {
  id: string; // Can be generated client-side or a simple index if stored in JSON
  text: string;
}

export interface QuizQuestion {
  id: string; // Can be generated client-side or a simple index
  questionText: string;
  options: QuizOption[];
  correctOptionId: string;
  points: number; 
  isBonus?: boolean; 
  imageUrl?: string;
  youtubeVideoId?: string;
}

export interface PredictionOption {
  id: string; // Can be generated client-side or simple index
  text: string; 
}

export interface Challenge {
  id: string; // UUID
  type: ChallengeType;
  title: string;
  description: string;
  pointsValue: number; 
  participationPoints?: number; 
  imageUrl?: string; 
  status: 'active' | 'completed' | 'expired';
  expiryDate?: string; // ISO date string
  questions?: QuizQuestion[]; // Stored as JSONB
  predictionOptions?: PredictionOption[]; // Stored as JSONB
  correctPredictionOptionId?: string;
  tournamentIds?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LeaderboardItem {
  id: string; 
  name: string;
  avatarUrl?: string;
  points: number;
  rank: number;
  country?: string;
  level?: number; 
  rankChange?: 'up' | 'down' | 'same';
}

export interface Tournament {
  id: string; // UUID
  name: string;
  description: string;
  endDate: string;   // ISO date string
  challengeIds?: string[]; // IDs of challenges in this tournament, fetched from junction table
  imageUrl?: string;
  created_at?: string;
  updated_at?: string;
}
