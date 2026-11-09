"use client";
import type { User } from "@/types";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { supabase, initializationError } from "@/lib/supabaseClient";
import type { AuthUser, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

type PasswordCredentials = { email: string; password: string };
type AuthResult = { success: boolean; error?: { message: string } };
type SignupProfile = Omit<
  User,
  | "id"
  | "email"
  | "points"
  | "level"
  | "created_at"
  | "updated_at"
  | "role"
  | "teamId"
>;
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  configError: string | null;
  loginWithPassword: (credentials: PasswordCredentials) => Promise<AuthResult>;
  signUpUser: (
    credentials: PasswordCredentials,
    userData: SignupProfile,
  ) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateUserPoints: (pointsToAdd: number) => Promise<void>;
  updateUserProfile: (updatedData: Partial<User>) => Promise<void>;
  assignTeamToUser: (teamId: string) => Promise<void>;
  removeUserFromTeam: () => Promise<void>;
  uploadAvatar: (
    file: File,
  ) => Promise<{ publicUrl: string | null; error: string | null }>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const configError = initializationError;
  const fetchUserProfile = useCallback(
    async (authUser: AuthUser | null): Promise<User | null> => {
      const client = supabase;
      if (!authUser || !client) return null;
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      if (error && error.code !== "PGRST116")
        console.error("Error fetching profile:", error.message);
      return error ? null : (data as User);
    },
    [],
  );
  useEffect(() => {
    const client = supabase;
    if (!client) {
      setIsLoading(false);
      return;
    }
    let active = true;
    let generation = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const hydrate = async (nextSession: Session | null, revision: number) => {
      try {
        const profile = await fetchUserProfile(nextSession?.user || null);
        if (active && revision === generation) {
          setSession(nextSession);
          setUser(profile);
        }
      } catch {
        if (active && revision === generation) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (active && revision === generation) setIsLoading(false);
      }
    };
    setIsLoading(true);
    const initialRevision = ++generation;
    void client.auth
      .getSession()
      .then(({ data }) => hydrate(data.session, initialRevision))
      .catch(() => {
        if (active && initialRevision === generation) setIsLoading(false);
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      const revision = ++generation;
      // Keep profile requests outside Supabase's auth-state callback lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        void hydrate(nextSession, revision);
      }, 0);
      timers.add(timer);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [fetchUserProfile]);
  const unavailable = (): AuthResult => ({
    success: false,
    error: { message: "Authentication is not configured." },
  });
  const loginWithPassword = async (
    credentials: PasswordCredentials,
  ): Promise<AuthResult> => {
    const client = supabase;
    if (!client) return unavailable();
    const { error } = await client.auth.signInWithPassword(credentials);
    if (error) {
      if (error.message.includes("Invalid login credentials"))
        toast({
          title: "Login Failed",
          description: "The email or password you entered is incorrect.",
          variant: "destructive",
        });
      return { success: false, error };
    }
    return { success: true };
  };
  const signUpUser = async (
    credentials: PasswordCredentials,
    profileData: SignupProfile,
  ): Promise<AuthResult> => {
    const client = supabase;
    if (!client) return unavailable();
    if (!credentials.email || !credentials.password)
      return {
        success: false,
        error: { message: "Email and password are required." },
      };
    const referralCode =
      profileData.referralCode ||
      `REF-${(profileData.name || "USER").replace(/\s+/g, "").toUpperCase().slice(0, 5)}${Date.now().toString().slice(-3)}`;
    const { data, error } = await client.auth.signUp({
      ...credentials,
      options: {
        data: {
          name: profileData.name,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          avatarUrl: profileData.avatarUrl,
          country: profileData.country,
          continent: profileData.continent,
          role: "player",
          referralCode,
          mobile: profileData.mobile,
          favouritePlayer: profileData.favouritePlayer,
          agreedToTerms: profileData.agreedToTerms,
        },
      },
    });
    if (error) return { success: false, error };
    return data.user
      ? { success: true }
      : {
          success: false,
          error: { message: "Signup completed but no user was returned." },
        };
  };
  const logout = async () => {
    const client = supabase;
    if (client) await client.auth.signOut();
    setUser(null);
    setSession(null);
    router.push("/login");
  };
  const updateUserPoints = async (pointsToAdd: number) => {
    const client = supabase;
    if (!user || !client) return;
    const points = user.points + pointsToAdd;
    const { data, error } = await client
      .from("profiles")
      .update({
        points,
        level: Math.floor(points / 250) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();
    if (error) console.error("Error updating points:", error.message);
    else if (data) setUser(data as User);
  };
  const updateUserProfile = async (updatedData: Partial<User>) => {
    const client = supabase;
    if (!user || !client) return;
    const { id, email, role, ...profileUpdates } = updatedData;
    const { data, error } = await client
      .from("profiles")
      .update({ ...profileUpdates, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();
    if (error) console.error("Error updating profile:", error.message);
    else if (data) setUser(data as User);
  };
  const setTeam = async (teamId: string | null) => {
    const client = supabase;
    if (!user || !client) return;
    const { data, error } = await client
      .from("profiles")
      .update({ teamId, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();
    if (error) console.error("Error updating team:", error.message);
    else if (data) setUser(data as User);
  };
  const assignTeamToUser = (teamId: string) => setTeam(teamId);
  const removeUserFromTeam = () => setTeam(null);
  const uploadAvatar = async (file: File) => {
    const client = supabase;
    if (!user)
      return {
        publicUrl: null,
        error: "You must be logged in to upload an avatar.",
      };
    if (!client)
      return { publicUrl: null, error: "Storage is not configured." };
    const filePath = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await client.storage
      .from("avatars")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });
    if (error) return { publicUrl: null, error: error.message };
    const { data } = client.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl
      ? { publicUrl: `${data.publicUrl}?t=${Date.now()}`, error: null }
      : { publicUrl: null, error: "Could not get avatar URL." };
  };
  return (
    <AuthContext.Provider
      value={{
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
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within an AuthProvider");
  return value;
};
