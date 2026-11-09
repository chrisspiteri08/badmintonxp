
"use client";
import React, { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { LogIn, UserCircle, Feather, UserPlus, FileText, Heart, Phone, Globe as GlobeIcon, Loader2 } from 'lucide-react';
import type { User } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SupabaseConfigErrorDisplay } from '@/components/layout/config-error-display';

const countries = [
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" }, { code: "DZ", name: "Algeria" },
  { code: "AS", name: "American Samoa" }, { code: "AD", name: "Andorra" }, { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" }, { code: "AQ", name: "Antarctica" }, { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" }, { code: "AM", name: "Armenia" }, { code: "AW", name: "Aruba" },
  { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" }, { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" }, { code: "BH", name: "Bahrain" }, { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" }, { code: "BY", name: "Belarus" }, { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" }, { code: "BJ", name: "Benin" }, { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" }, { code: "BO", name: "Bolivia" }, { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" }, { code: "BR", name: "Brazil" }, { code: "IO", name: "British Indian Ocean Territory" },
  { code: "BN", name: "Brunei Darussalam" }, { code: "BG", name: "Bulgaria" }, { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" }, { code: "KH", name: "Cambodia" }, { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" }, { code: "CV", name: "Cape Verde" }, { code: "KY", name: "Cayman Islands" },
  { code: "CF", name: "Central African Republic" }, { code: "TD", name: "Chad" }, { code: "CL", name: "Chile" },
  { code: "CN", name: "China" }, { code: "CX", name: "Christmas Island" }, { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "CO", name: "Colombia" }, { code: "KM", name: "Comoros" }, { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo, The Democratic Republic of the" }, { code: "CK", name: "Cook Islands" },
  { code: "CR", name: "Costa Rica" }, { code: "CI", name: "Cote D'Ivoire" }, { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" }, { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" }, { code: "DJ", name: "Djibouti" }, { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" }, { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" }, { code: "GQ", name: "Equatorial Guinea" }, { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" }, { code: "ET", name: "Ethiopia" }, { code: "FK", name: "Falkland Islands (Malvinas)" },
  { code: "FO", name: "Faroe Islands" }, { code: "FJ", name: "Fiji" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "GF", name: "French Guiana" }, { code: "PF", name: "French Polynesia" },
  { code: "GA", name: "Gabon" }, { code: "GM", name: "Gambia" }, { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" }, { code: "GH", name: "Ghana" }, { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" }, { code: "GL", name: "Greenland" }, { code: "GD", name: "Grenada" },
  { code: "GP", name: "Guadeloupe" }, { code: "GU", name: "Guam" }, { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" }, { code: "GW", name: "Guinea-Bissau" }, { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" }, { code: "VA", name: "Holy See (VaticAN City State)" }, { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" }, { code: "HU", name: "Hungary" }, { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" }, { code: "ID", name: "Indonesia" }, { code: "IR", name: "Iran, Islamic Republic Of" },
  { code: "IQ", name: "Iraq" }, { code: "IE", name: "Ireland" }, { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" }, { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" }, { code: "KZ", name: "Kazakhstan" }, { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" }, { code: "KP", name: "Korea, Democratic People's Republic of" },
  { code: "KR", name: "Korea, Republic of" }, { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Lao People's Democratic Republic" }, { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" }, { code: "LS", name: "Lesotho" }, { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libyan Arab Jamahiriya" }, { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" }, { code: "MO", name: "Macao" },
  { code: "MK", name: "Macedonia, The Former Yugoslav Republic of" }, { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" }, { code: "MY", name: "Malaysia" }, { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" }, { code: "MT", name: "Malta" }, { code: "MH", name: "Marshall Islands" },
  { code: "MQ", name: "Martinique" }, { code: "MR", name: "Mauritania" }, { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" }, { code: "FM", name: "Micronesia, Federated States of" },
  { code: "MD", name: "Moldova, Republic of" }, { code: "MC", name: "Monaco" }, { code: "MN", name: "Mongolia" },
  { code: "MS", name: "Montserrat" }, { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" }, { code: "NA", name: "Namibia" }, { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" }, { code: "NL", name: "Netherlands" }, { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand" }, { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" }, { code: "NU", name: "Niue" }, { code: "NF", "name": "Norfolk Island" },
  { code: "MP", name: "Northern Mariana Islands" }, { code: "NO", name: "Norway" }, { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" }, { code: "PW", name: "Palau" }, { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" }, { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" }, { code: "PN", name: "Pitcairn" }, { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" }, { code: "PR", name: "Puerto Rico" }, { code: "QA", name: "Qatar" },
  { code: "RE", name: "Reunion" }, { code: "RO", name: "Romania" }, { code: "RU", name: "Russian Federation" },
  { code: "RW", name: "Rwanda" }, { code: "SH", name: "Saint Helena" }, { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" }, { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "VC", name: "Saint Vincent and the Grenadines" }, { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" }, { code: "ST", name: "Sao Tome and Principe" }, { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" }, { code: "CS", name: "Serbia and Montenegro" }, { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" }, { code: "SG", name: "Singapore" }, { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" }, { code: "SB", name: "Solomon Islands" }, { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" }, { code: "ES", name: "Spain" }, { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" }, { code: "SR", name: "Suriname" }, { code: "SZ", name: "Swaziland" },
  { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syrian Arab Republic" },
  { code: "TW", name: "Taiwan" }, { code: "TJ", name: "Tajikistan" }, { code: "TZ", name: "Tanzania, United Republic of" },
  { code: "TH", name: "Thailand" }, { code: "TG", name: "Togo" }, { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" }, { code: "TT", name: "Trinidad and Tobago" }, { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" }, { code: "TM", name: "Turkmenistan" }, { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" }, { code: "UG", name: "Uganda" }, { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" }, { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" }, { code: "UZ", name: "Uzbekistan" }, { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" }, { code: "VN", name: "Viet Nam" }, { code: "VG", name: "Virgin Islands, British" },
  { code: "VI", name: "Virgin Islands, U.S." }, { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" }
];

function LoginLogic() {
  const { loginWithPassword, signUpUser, user, isLoading, configError } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupCountry, setSignupCountry] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupFavouritePlayer, setSignupFavouritePlayer] = useState('');
  const [signupAgreedToTerms, setSignupAgreedToTerms] = useState(false);
  const [signupReferralCode, setSignupReferralCode] = useState('');

  useEffect(() => {
    const referralCode = searchParams.get('ref');
    if (referralCode) {
      setIsSigningUp(true);
      setSignupReferralCode(referralCode);
      toast({
        title: "Referral Detected!",
        description: `Sign up to get your bonus XP!`,
        variant: "default"
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'admin') router.push('/admin');
      else router.push('/dashboard');
    }
  }, [user, isLoading, router]);
  
  if (configError) {
    return <SupabaseConfigErrorDisplay error={configError} />;
  }

  const handlePlayerLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
        toast({ title: "Login Failed", description: "Please enter both email and password.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const { success, error } = await loginWithPassword({ email: loginEmail, password: loginPassword });
    setIsSubmitting(false);
    if (!success) {
        toast({ title: "Login Failed", description: error?.message || "Invalid email or password.", variant: "destructive"});
    }
  };

  const handlePlayerSignUp = async (e: FormEvent) => {
    e.preventDefault();
     if (!signupFirstName || !signupLastName || !signupCountry || !signupEmail || !signupPassword) {
        toast({ title: "Sign Up Failed", description: "Please fill in all required fields (First Name, Last Name, Country, Email, Password).", variant: "destructive"});
        return;
    }
    if (!signupAgreedToTerms) {
        toast({ title: "Sign Up Failed", description: "You must agree to the Privacy Policy and GDPR Rules.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    const fullName = `${signupFirstName} ${signupLastName}`.trim();
    const profileData: Omit<User, 'id' | 'email' | 'points' | 'level' | 'created_at' | 'updated_at' | 'role' | 'teamId' | 'agreedToTerms'> & {agreedToTerms: boolean} = {
        name: fullName,
        firstName: signupFirstName,
        lastName: signupLastName,
        country: signupCountry,
        avatarUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent((fullName[0] || '').toUpperCase())}`,
        continent: 'Unknown',
        referralCode: signupReferralCode,
        mobile: signupMobile,
        favouritePlayer: signupFavouritePlayer,
        agreedToTerms: signupAgreedToTerms,
    };

    const { success, error } = await signUpUser({ email: signupEmail, password: signupPassword }, profileData);
    setIsSubmitting(false);

    if (success) {
        toast({
            title: "Sign Up Successful!",
            description: "Please check your email to confirm your account. Then you can log in.",
            variant: "default",
            duration: 7000,
        });
        setIsSigningUp(false);
        setLoginEmail(signupEmail);
        setLoginPassword('');
    } else {
         toast({ title: "Sign Up Failed", description: error?.message || "Could not create account. Email might be taken.", variant: "destructive"});
    }
  };


  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary via-background to-background p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="text-lg text-foreground mt-4">Loading BadmintonXP...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary via-background to-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-2 border-primary/50 bg-card/80 backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full border-4 border-accent shadow-lg bg-primary p-4 inline-block">
            <Feather className="h-16 w-16 text-accent-foreground" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tight text-foreground">Welcome to BadmintonXP!</CardTitle>
          <CardDescription className="text-muted-foreground text-base mt-1">
            {isSigningUp ? "Create your account to join the game." : "Sign in or sign up to level up your game."}
          </CardDescription>
        </CardHeader>

        {isSigningUp ? (
            <form onSubmit={handlePlayerSignUp}>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="signupFirstName">First Name</Label>
                            <Input id="signupFirstName" value={signupFirstName} onChange={(e) => setSignupFirstName(e.target.value)} placeholder="Lee" required disabled={isSubmitting} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="signupLastName">Last Name</Label>
                            <Input id="signupLastName" value={signupLastName} onChange={(e) => setSignupLastName(e.target.value)} placeholder="Chong Wei" required disabled={isSubmitting} />
                        </div>
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="signupCountry">Country</Label>
                        <Select value={signupCountry} onValueChange={setSignupCountry} required disabled={isSubmitting}>
                            <SelectTrigger id="signupCountry" className="w-full bg-background/70 border-primary/50 focus:bg-background">
                                <SelectValue placeholder="Select your country" />
                            </SelectTrigger>
                            <SelectContent>
                                <ScrollArea className="h-60">
                                {countries.map(country => (
                                    <SelectItem key={country.code} value={country.name}>
                                        {country.name}
                                    </SelectItem>
                                ))}
                                </ScrollArea>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="signupEmail">Email</Label>
                        <Input id="signupEmail" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="you@example.com" required disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="signupPassword">Password</Label>
                        <Input id="signupPassword" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder="••••••••" required disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="signupMobile" className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Mobile (Optional)</Label>
                        <Input id="signupMobile" type="tel" value={signupMobile} onChange={(e) => setSignupMobile(e.target.value)} placeholder="+1234567890" disabled={isSubmitting} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="signupFavouritePlayer" className="flex items-center"><Heart className="mr-2 h-4 w-4 text-muted-foreground"/>Favourite Player (Optional)</Label>
                        <Input id="signupFavouritePlayer" value={signupFavouritePlayer} onChange={(e) => setSignupFavouritePlayer(e.target.value)} placeholder="e.g., Viktor Axelsen" disabled={isSubmitting} />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="signupAgreedToTerms" checked={signupAgreedToTerms} onCheckedChange={(checked) => setSignupAgreedToTerms(checked as boolean)} disabled={isSubmitting} />
                        <Label htmlFor="signupAgreedToTerms" className="text-sm font-normal text-muted-foreground">
                            I agree to the BadmintonXP Privacy Policy and GDPR Rules. <span className="text-destructive">*</span>
                        </Label>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-3">
                    <Button type="submit" className="w-full text-lg py-6 btn-game" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <UserPlus className="mr-2 h-6 w-6" />}
                        Create Account
                    </Button>
                    <Button variant="link" onClick={() => setIsSigningUp(false)} className="text-accent hover:underline p-0 h-auto" disabled={isSubmitting}>
                        Already have an account? Login
                    </Button>
                </CardFooter>
            </form>
        ) : (
            <form onSubmit={handlePlayerLogin}>
                <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="loginEmail" className="text-lg font-medium flex items-center text-foreground/90">
                    <UserCircle className="mr-2 h-5 w-5 text-primary" /> Email
                    </Label>
                    <Input
                    id="loginEmail"
                    type="email"
                    placeholder="player@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="text-base py-3 px-4 bg-background/70 border-primary/50 focus:bg-background"
                    disabled={isSubmitting}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="loginPassword" className="text-lg font-medium flex items-center text-foreground/90">
                    <LogIn className="mr-2 h-5 w-5 text-primary" /> Password
                    </Label>
                    <Input
                    id="loginPassword"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="text-base py-3 px-4 bg-background/70 border-primary/50 focus:bg-background"
                    disabled={isSubmitting}
                    />
                </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full text-lg py-6 btn-game" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <LogIn className="mr-2 h-6 w-6" />}
                    Login as Player
                </Button>
                <div className="text-center w-full">
                    <p className="text-sm text-muted-foreground">
                    No account?{' '}
                    <Button
                        variant="link"
                        className="text-accent hover:underline p-0 h-auto text-sm"
                        onClick={() => setIsSigningUp(true)}
                        disabled={isSubmitting}
                    >
                        Sign up here!
                    </Button>
                    </p>
                </div>

                </CardFooter>
            </form>
        )}
      </Card>
      <p className="mt-8 text-center text-sm text-primary/80">
        BadmintonXP &copy; {new Date().getFullYear()} - The Badminton Community Game.
      </p>
    </div>
  );
}

export default function LoginPage() {
  const fallbackContent = (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary via-background to-background p-4">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="text-lg text-foreground mt-4">Loading Login...</p>
    </div>
  );

  return (
    <Suspense fallback={fallbackContent}>
      <LoginLogic />
    </Suspense>
  );
}
