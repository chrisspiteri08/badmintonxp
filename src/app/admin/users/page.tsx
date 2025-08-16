
"use client";
import { useState, useMemo, FormEvent, ChangeEvent, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Edit3, Trash2, Shield, User as UserIconLucide, Users as UsersIcon, Loader2 } from "lucide-react";
import type { User as UserType } from '@/types';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/auth-context';
import { Checkbox } from "@/components/ui/checkbox";


const initialUserFormData: Omit<UserType, 'id' | 'email' | 'referralCode' | 'level' | 'created_at' | 'updated_at'> & { level?: number, email?: string, password?: string } = {
  name: '',
  firstName: '',
  lastName: '',
  avatarUrl: '',
  points: 0,
  country: '',
  continent: 'Asia',
  role: 'player',
  teamId: undefined,
  agreedToTerms: true, // Default for admin creation
};


export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [currentUserFormData, setCurrentUserFormData] = useState<typeof initialUserFormData>({...initialUserFormData});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ title: "Error fetching users", description: error.message, variant: "destructive" });
      setUsers([]);
    } else {
      setUsers(data as UserType[]);
    }
    setIsLoading(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.country && user.country.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [users, searchTerm]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentUserFormData(prev => ({ ...prev, [name]: name === 'points' || name === 'level' ? parseInt(value, 10) || 0 : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentUserFormData(prev => ({ ...prev, [name]: value as UserType['role'] }));
  };

  const resetDialogState = () => {
    setEditingUser(null);
    setCurrentUserFormData({...initialUserFormData});
  };

  const handleOpenAddDialog = () => {
    resetDialogState();
    setShowUserDialog(true);
  };

  const handleOpenEditDialog = (userToEdit: UserType) => {
    setEditingUser(userToEdit);
    setCurrentUserFormData({
      name: userToEdit.name,
      firstName: userToEdit.firstName,
      lastName: userToEdit.lastName,
      email: userToEdit.email, // For display, not updatable via this form for existing users
      avatarUrl: userToEdit.avatarUrl || '',
      points: userToEdit.points,
      level: userToEdit.level,
      country: userToEdit.country,
      continent: userToEdit.continent,
      role: userToEdit.role,
      teamId: userToEdit.teamId,
      agreedToTerms: userToEdit.agreedToTerms !== undefined ? userToEdit.agreedToTerms : true,
    });
    setShowUserDialog(true);
  };
  
  const handleUserFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUserFormData.name || (editingUser ? false : (!currentUserFormData.email || !currentUserFormData.password)) ) {
      toast({ title: "Error", description: "Name is required. Email and Password are required for new users.", variant: "destructive" });
      return;
    }

    setIsLoading(true); // For form submission
    const calculatedLevel = Math.floor((currentUserFormData.points || 0) / 250) + 1;
    const profileUpdateData = {
        name: currentUserFormData.name,
        firstName: currentUserFormData.firstName,
        lastName: currentUserFormData.lastName,
        avatarUrl: currentUserFormData.avatarUrl || `https://placehold.co/100x100.png?text=${encodeURIComponent((currentUserFormData.name?.substring(0,2) || '').toUpperCase())}`,
        points: currentUserFormData.points,
        level: currentUserFormData.level !== undefined ? currentUserFormData.level : calculatedLevel,
        country: currentUserFormData.country,
        continent: currentUserFormData.continent,
        role: currentUserFormData.role,
        teamId: currentUserFormData.teamId || null,
        agreedToTerms: currentUserFormData.agreedToTerms,
        updated_at: new Date().toISOString(),
    };

    if (editingUser) {
      // Update existing user's profile
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdateData)
        .eq('id', editingUser.id);

      if (error) {
        toast({ title: "Update Failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "User Updated", description: `User "${profileUpdateData.name}" has been updated.` });
        fetchUsers(); // Refresh list
        setShowUserDialog(false);
        resetDialogState();
      }
    } else {
      // Create new user via Supabase Auth, then profile is created by trigger
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: currentUserFormData.email!,
        password: currentUserFormData.password!,
        options: {
          data: { // This data is passed to the handle_new_user trigger
            ...profileUpdateData,
            referralCode: `ADMINCREATE${Date.now().toString().slice(-4)}`
          }
        }
      });

      if (authError) {
        toast({ title: "User Creation Failed", description: authError.message, variant: "destructive" });
      } else if (authData.user) {
        // If needs email confirmation, user won't be active immediately.
        // For admin creation, usually auto-confirm or set user as confirmed.
        // We assume profile trigger works.
        // If user is created but profile trigger might be slow, or if manual profile update is needed:
        // await supabase.from('profiles').update(profileUpdateData).eq('id', authData.user.id);
        
        toast({ title: "User Added", description: `User "${profileUpdateData.name}" has been created. They might need to confirm their email.` });
        fetchUsers(); // Refresh list
        setShowUserDialog(false);
        resetDialogState();
      }
    }
    setIsLoading(false);
  };

  const handleDeleteUser = async (userIdToDelete: string) => {
    const userBeingDeleted = users.find(u => u.id === userIdToDelete);
    if (!userBeingDeleted) return;

    if (userBeingDeleted.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      toast({ title: "Action Denied", description: "Cannot delete the last admin user.", variant: "destructive" });
      return;
    }
    if (userBeingDeleted.id === adminUser?.id) {
      toast({ title: "Action Denied", description: "Cannot delete your own admin account.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    // Supabase admin functions are needed to delete users from auth.users.
    // This requires elevated privileges not available via client-side anon key.
    // Typically, this would be done via a server-side function or Supabase dashboard.
    // For this client-side prototype, we will only delete from 'profiles'.
    // The user will still exist in auth.users.

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userIdToDelete);

    if (profileError) {
      toast({ title: "Deletion Failed", description: `Could not delete profile: ${profileError.message}`, variant: "destructive" });
    } else {
      // Also attempt to update team if this user was a captain
      // This part remains complex as it requires checking team, reassigning captain etc.
      // For simplification, we'll focus on profile deletion.
      // In a real app, a server-side function would handle cascading deletes/updates.
      toast({ title: "User Profile Deleted", description: `Profile for "${userBeingDeleted.name}" removed. Auth user may still exist.` });
      fetchUsers(); // Refresh list
    }
    setIsLoading(false);
  };

  if (isLoading && users.length === 0) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading users...</span></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <UsersIcon className="h-8 w-8 mr-3 text-accent" /> User Management
          </CardTitle>
          <CardDescription className="text-lg">
            View, add, edit, or delete user profiles from the Supabase database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                type="search" 
                placeholder="Search users by name, email, country..."
                className="pl-10 h-11 text-base w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <Dialog open={showUserDialog} onOpenChange={(isOpen) => {
                setShowUserDialog(isOpen);
                if (!isOpen) { 
                    resetDialogState();
                }
            }}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenAddDialog} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base py-2.5 px-5 w-full md:w-auto">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add New User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
                  <DialogDescription>
                    {editingUser ? "Modify the details for this user." : "Fill in the details for the new user."}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(70vh-100px)] pr-6">
                <form onSubmit={handleUserFormSubmit} className="grid gap-4 py-4" id="userDialogForm">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Display Name</Label>
                    <Input id="name" name="name" value={currentUserFormData.name} onChange={handleInputChange} className="col-span-3" required />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="firstName" className="text-right">First Name</Label>
                    <Input id="firstName" name="firstName" value={currentUserFormData.firstName || ''} onChange={handleInputChange} className="col-span-3"/>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="lastName" className="text-right">Last Name</Label>
                    <Input id="lastName" name="lastName" value={currentUserFormData.lastName || ''} onChange={handleInputChange} className="col-span-3"/>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input 
                        id="email" 
                        name="email" 
                        type="email" 
                        value={currentUserFormData.email || ''} 
                        onChange={handleInputChange} 
                        className="col-span-3" 
                        required={!editingUser} 
                        disabled={!!editingUser} 
                        placeholder={editingUser ? 'Email cannot be changed' : 'user@example.com'}
                    />
                  </div>
                  {!editingUser && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">Password</Label>
                        <Input 
                            id="password" 
                            name="password" 
                            type="password" 
                            value={currentUserFormData.password || ''} 
                            onChange={handleInputChange} 
                            className="col-span-3" 
                            placeholder="Required for new user"
                            required={!editingUser} 
                        />
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="avatarUrl" className="text-right">Avatar URL</Label>
                    <Input id="avatarUrl" name="avatarUrl" value={currentUserFormData.avatarUrl || ''} onChange={handleInputChange} className="col-span-3" placeholder="https://placehold.co/100x100.png"/>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">Role</Label>
                    <Select name="role" value={currentUserFormData.role} onValueChange={(value) => handleSelectChange('role', value)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="country" className="text-right">Country</Label>
                    <Input id="country" name="country" value={currentUserFormData.country || ''} onChange={handleInputChange} className="col-span-3" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="continent" className="text-right">Continent</Label>
                    <Input id="continent" name="continent" value={currentUserFormData.continent || ''} onChange={handleInputChange} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="points" className="text-right">Points</Label>
                    <Input id="points" name="points" type="number" value={currentUserFormData.points} onChange={handleInputChange} className="col-span-3" min="0"/>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="level" className="text-right">Level (Opt.)</Label>
                    <Input id="level" name="level" type="number" value={currentUserFormData.level === undefined ? '' : currentUserFormData.level} onChange={handleInputChange} className="col-span-3" placeholder="Auto-calculated if blank" min="1"/>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="teamId" className="text-right">Team ID (Opt.)</Label>
                    <Input id="teamId" name="teamId" value={currentUserFormData.teamId || ''} onChange={handleInputChange} className="col-span-3" placeholder="UUID of team"/>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="agreedToTerms" className="text-right">Agreed to Terms</Label>
                    <Checkbox id="agreedToTerms" name="agreedToTerms" checked={currentUserFormData.agreedToTerms} onCheckedChange={(checked) => setCurrentUserFormData(prev => ({...prev, agreedToTerms: !!checked}))} className="col-span-3 justify-self-start" />
                  </div>
                </form>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={resetDialogState}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" form="userDialogForm" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                        {isLoading && (showUserDialog) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {editingUser ? "Save Changes" : "Add User"}
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
                <TableHead className="w-[80px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Level</TableHead>
                <TableHead className="text-center w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="profile avatar"/>
                      <AvatarFallback>{user.name?.substring(0, 2).toUpperCase() || 'N/A'}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize gap-1">
                      {user.role === 'admin' ? <Shield className="h-3 w-3"/> : <UserIconLucide className="h-3 w-3"/>}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.country}</TableCell>
                  <TableCell className="text-right">{user.points.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{user.level}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(user)}>
                            <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialogTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start text-sm text-destructive hover:text-destructive hover:bg-destructive/10 p-2" 
                                    disabled={user.id === adminUser?.id || (user.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete User
                            </Button>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the user's profile data. The Auth user may still exist in Supabase Auth if not deleted via server-side logic.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yes, delete profile"}
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
         {filteredUsers.length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">No users found matching your criteria.</div>
        )}
      </Card>
    </div>
  );
}

    