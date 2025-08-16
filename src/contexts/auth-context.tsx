
"use client";
import type { User } from '@/types';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, initializationError } from '@/lib/supabaseClient';
import type { AuthUser, Session, UserCredentials } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  configError: string | null;
  loginWithPassword: (credentials: UserCredentials) => Promise<{ success: boolean; error?: any }>;
  signUpUser: (credentials: UserCredentials, userData: Omit<User, 'id' | 'email' | 'points' | 'level' | 'created_at' | 'updated_at' | 'role' | 'teamId'>, isAdmin?: boolean) => Promise<{ success: boolean; error?: any }>;
  logout: () => Promise<void>;
  updateUserPoints: (pointsToAdd: number) => Promise<void>;
  updateUserProfile: (updatedData: Partial<User>) => Promise<void>;
  assignTeamToUser: (teamId: string) => Promise<void>;
  removeUserFromTeam: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<{ publicUrl: string | null; error: string | null; }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(initializationError);
  const router = useRouter();

  const fetchUserProfile = useCallback(async (authUser: AuthUser | null): Promise<User | null> => {
    if (!authUser || !supabase) {
        return null;
    }
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is a valid case during signup.
            console.error('Error fetching profile:', error);
            return null;
        }
        return profile as User;
    } catch (e) {
        console.error("Exception fetching profile:", e);
        return null;
    }
  }, []);

  useEffect(() => {
    if (configError) {
      setIsLoading(false);
      return;
    }
    
    // Set initial loading to true and then check session.
    setIsLoading(true);

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
        setSession(initialSession);
        const profile = await fetchUserProfile(initialSession?.user || null);
        setUser(profile);
        setIsLoading(false); // Done loading initial state.

        // Now, set up the listener for future auth state changes.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            setSession(newSession);
            const newProfile = await fetchUserProfile(newSession?.user || null);
            setUser(newProfile);
            // This loading is for transitions (e.g. login -> dashboard), not initial load
            if (_event === 'SIGNED_IN') setIsLoading(false);
            if (_event === 'SIGNED_OUT') setIsLoading(false);
          }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }).catch(e => {
        console.error("Error in getSession promise:", e);
        setIsLoading(false);
    });

  }, [configError, fetchUserProfile]);


  const loginWithPassword = async (credentials: UserCredentials) => {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
        if (error.message.includes('Invalid login credentials')) {
            toast({
                title: "Login Failed",
                description: "The email or password you entered is incorrect.",
                variant: "destructive",
            });
        }
        console.error('Login error:', error);
        return { success: false, error };
    }
    // onAuthStateChange will handle setting the user and session
    return { success: true };
  };

  const signUpUser = async (credentials: UserCredentials, profileData: Omit<User, 'id' | 'email' | 'points' | 'level' | 'created_at' | 'updated_at' | 'role' | 'teamId'>, isAdmin = false) => {
    const { email, password } = credentials;
    if (!email || !password) {
        return { success: false, error: { message: "Email and password are required."}};
    }

    const referralCode = profileData.referralCode || `REF-${(profileData.name || 'USER').replace(/\s+/g, '').toUpperCase().slice(0,5)}${Date.now().toString().slice(-3)}`;

    const { data: signUpResponse, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
          data: {
            name: profileData.name,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            avatarUrl: profileData.avatarUrl,
            country: profileData.country,
            continent: profileData.continent,
            role: isAdmin ? 'admin' : 'player',
            referralCode: referralCode,
            mobile: profileData.mobile,
            favouritePlayer: profileData.favouritePlayer,
            agreedToTerms: profileData.agreedToTerms,
          }
      }
    });

    if (signUpError) {
      console.error('Sign up error:', signUpError);
      return { success: false, error: signUpError };
    }
    if (signUpResponse.user) {
      return { success: true };
    }
    return { success: false, error: { message: "Signup completed but no user session returned."}};
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    router.push('/login');
  };

  const updateUserPoints = async (pointsToAdd: number) => {
    if (!user) return;
    const newTotalPoints = user.points + pointsToAdd;
    const newLevel = Math.floor(newTotalPoints / 250) + 1;

    const { data, error } = await supabase
      .from('profiles')
      .update({ points: newTotalPoints, level: newLevel, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) console.error("Error updating user points:", error);
    else if (data) setUser(data as User);
  };

  const updateUserProfile = async (updatedData: Partial<User>) => {
    if (!user) return;
    const { id, email, role, ...profileUpdates } = updatedData;

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...profileUpdates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) console.error("Error updating user profile:", error);
    else if (data) setUser(data as User);
  };

  const assignTeamToUser = async (teamId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ teamId: teamId, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) console.error("Error assigning team to user:", error);
    else if (data) setUser(data as User);
  };

  const removeUserFromTeam = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ teamId: null, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) console.error("Error removing user from team:", error);
    else if (data) setUser(data as User);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return { publicUrl: null, error: "You must be logged in to upload an avatar." };
    if (!supabase) return { publicUrl: null, error: "Database connection not found." };
    
    const fileExt = file.name.split('.').pop();
    // Correctly construct the path to be user_id/avatar.ext
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true, // Use upsert to allow overwriting the file
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return { publicUrl: null, error: uploadError.message };
    }

    // After a successful upload, construct the public URL manually.
    // The getPublicUrl method has been less reliable in some setups, so this is a safer approach.
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
        return { publicUrl: null, error: "Could not get public URL after upload." };
    }

    const publicUrlWithTimestamp = `${data.publicUrl}?t=${new Date().getTime()}`;

    return { publicUrl: publicUrlWithTimestamp, error: null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      configError,
      loginWithPassword,
      signUpUser,
      logout,
      updateUserPoints,
      updateUserProfile,
      assignTeamToUser,
      removeUserFromTeam,
      uploadAvatar
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
