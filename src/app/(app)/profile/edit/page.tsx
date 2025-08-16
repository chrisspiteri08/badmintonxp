
"use client";
import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, UserCircle, Image as ImageIcon, Globe, Loader2, UploadCloud } from 'lucide-react';
import type { User } from '@/types';
import Image from 'next/image';

export default function EditProfilePage() {
  const { user, updateUserProfile, uploadAvatar, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    country: '',
    firstName: '',
    lastName: '',
    mobile: '',
    favouritePlayer: '',
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        country: user.country || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        mobile: user.mobile || '',
        favouritePlayer: user.favouritePlayer || '',
      });
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "File Too Large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    let updatedData: Partial<User> = {};
    
    // Check for form data changes
    if (formData.name.trim() && formData.name !== user.name) updatedData.name = formData.name.trim();
    if (formData.firstName.trim() && formData.firstName !== user.firstName) updatedData.firstName = formData.firstName.trim();
    if (formData.lastName.trim() && formData.lastName !== user.lastName) updatedData.lastName = formData.lastName.trim();
    if (formData.country.trim() && formData.country !== user.country) updatedData.country = formData.country.trim();
    if (formData.mobile.trim() && formData.mobile !== user.mobile) updatedData.mobile = formData.mobile.trim();
    if (formData.favouritePlayer.trim() && formData.favouritePlayer !== user.favouritePlayer) updatedData.favouritePlayer = formData.favouritePlayer.trim();
    
    let changesMade = Object.keys(updatedData).length > 0;

    // Handle avatar upload if a new file is selected
    if (avatarFile) {
        const { publicUrl, error } = await uploadAvatar(avatarFile);
        if (error) {
            toast({ title: "Upload Failed", description: error, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        if (publicUrl) {
            updatedData.avatarUrl = publicUrl;
            changesMade = true;
        }
    }

    if (!changesMade) {
        toast({ title: "No Changes", description: "You haven't made any changes." });
        setIsSubmitting(false);
        return;
    }

    await updateUserProfile(updatedData);
    setIsSubmitting(false);
    toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
    router.push('/profile');
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 text-sm text-muted-foreground hover:text-foreground self-start -ml-2">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Profile
          </Button>
          <CardTitle className="text-3xl font-bold text-primary">Edit Your Profile</CardTitle>
          <CardDescription>Make changes to your personal information.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
             <div className="space-y-2">
              <Label className="text-base font-medium flex items-center">
                <ImageIcon className="mr-2 h-5 w-5 text-primary" /> Profile Picture
              </Label>
              <div className="flex items-center gap-4">
                  {avatarPreview && (
                     <Image src={avatarPreview} alt="Avatar preview" width={80} height={80} className="rounded-full object-cover border-2 border-primary" data-ai-hint="profile avatar" />
                  )}
                  <Input 
                    id="avatarFile" 
                    type="file" 
                    accept="image/png, image/jpeg"
                    onChange={handleAvatarChange}
                    className="hidden" 
                    disabled={isSubmitting}
                    />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('avatarFile')?.click()} disabled={isSubmitting}>
                    <UploadCloud className="mr-2 h-4 w-4" /> Change Image
                  </Button>
                  <p className="text-xs text-muted-foreground">Max 2MB. JPG or PNG.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-medium flex items-center">
                <UserCircle className="mr-2 h-5 w-5 text-primary" /> Display Name
              </Label>
              <Input id="name" name="name" value={formData.name} onChange={handleFormChange} placeholder="Your display name" className="h-11 text-base" required disabled={isSubmitting} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-base font-medium">First Name</Label>
                    <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleFormChange} placeholder="Your first name" className="h-11 text-base" disabled={isSubmitting}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-base font-medium">Last Name</Label>
                    <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleFormChange} placeholder="Your last name" className="h-11 text-base" disabled={isSubmitting}/>
                </div>
            </div>
           
            <div className="space-y-2">
              <Label htmlFor="country" className="text-base font-medium flex items-center">
                <Globe className="mr-2 h-5 w-5 text-primary" /> Country
              </Label>
              <Input id="country" name="country" value={formData.country} onChange={handleFormChange} placeholder="Your country of residence" className="h-11 text-base" disabled={isSubmitting}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="mobile" className="text-base font-medium">Mobile (Optional)</Label>
                <Input id="mobile" name="mobile" value={formData.mobile} onChange={handleFormChange} placeholder="Your mobile number" className="h-11 text-base" disabled={isSubmitting}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="favouritePlayer" className="text-base font-medium">Favourite Player (Optional)</Label>
                <Input id="favouritePlayer" name="favouritePlayer" value={formData.favouritePlayer} onChange={handleFormChange} placeholder="e.g. Lee Chong Wei" className="h-11 text-base" disabled={isSubmitting}/>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/profile')} className="text-base py-2.5 px-5" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base py-2.5 px-5" disabled={isSubmitting || authLoading}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
