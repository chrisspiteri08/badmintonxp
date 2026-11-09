
"use client";
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import {
  Gamepad2, 
  Trophy,
  Users,
  Puzzle,
  UserCircle,
  LogOut,
  Shield,
  Settings,
  Menu,
  Feather,
  Star, 
  Swords, 
  BarChart3,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  href?: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  subItems?: Omit<NavItem, 'subItems'>[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Gamepad2 }, 
  { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/challenges', label: 'Challenges', icon: Puzzle },
  { href: '/tournaments', label: 'Tournaments', icon: Swords },
  { 
    label: 'Minigames', 
    icon: LayoutGrid,
    subItems: [
      { href: '/shuttle-kill', label: 'Shuttle Kill', icon: Star },
    ]
   },
];

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: BarChart3, adminOnly: true },
  { href: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
  { href: '/admin/teams', label: 'Teams', icon: Shield, adminOnly: true }, 
  { href: '/admin/challenges', label: 'Challenges', icon: Puzzle, adminOnly: true },
  { href: '/admin/tournaments', label: 'Tournaments', icon: Swords, adminOnly: true },
];


const MobileBottomNav = ({ isAdminRoute }: { isAdminRoute: boolean }) => {
    const pathname = usePathname();
    const currentNavItems = isAdminRoute ? adminNavItems : navItems;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 flex md:hidden items-center justify-around">
            {currentNavItems.filter(item => item.href).map((item) => {
                 const isActive = pathname === item.href || ((!!item.href && pathname.startsWith(item.href)) && item.href !== (isAdminRoute ? "/admin" : "/dashboard"));
                return (
                    <Link href={item.href!} key={item.href} legacyBehavior>
                        <a className={cn(
                            "flex flex-col items-center justify-center text-xs gap-1 transition-colors w-full h-full",
                            isActive ? "text-accent font-bold" : "text-muted-foreground hover:text-foreground"
                        )}>
                            <item.icon className="h-6 w-6" />
                            <span>{item.label}</span>
                        </a>
                    </Link>
                );
            })}
        </div>
    );
};


export function AppShell({ children, isAdminRoute = false }: { children: ReactNode, isAdminRoute?: boolean }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();
  
  const mainNavItems = isAdminRoute ? adminNavItems : navItems;
  const secondaryNavItems = [
      ...(isAdminRoute ? [{ href: '/admin/settings', label: 'App Settings', icon: Settings, adminOnly: true }] : []),
      { href: '/profile', label: 'My Profile', icon: UserCircle},
  ];

  const toggleSubMenu = (label: string) => {
    setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-0 sticky top-0 z-10">
           <div className="bg-gradient-to-r from-[hsl(var(--sidebar-header-grad-start))] to-[hsl(var(--sidebar-header-grad-end))] p-4 h-[88px] flex flex-col justify-center">
            <Link href={isAdminRoute ? "/admin" : "/dashboard"} className="block group-data-[collapsible=icon]:hidden">
              <h1 className="text-3xl font-black text-white tracking-tight">BadmintonXP</h1>
              <div className="h-[3px] w-24 bg-accent mt-1 rounded-full"></div>
            </Link>
             <Link href={isAdminRoute ? "/admin" : "/dashboard"} className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full h-full">
                <Feather className="h-7 w-7 text-white" />
            </Link>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="mt-2">
            {mainNavItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                {item.subItems ? (
                  <>
                    <SidebarMenuButton
                      onClick={() => toggleSubMenu(item.label)}
                      tooltip={{ children: item.label, className: "bg-accent text-accent-foreground" }}
                      className="text-base justify-between"
                      isActive={item.subItems.some(sub => pathname.startsWith(sub.href!))}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", openSubMenus[item.label] && "rotate-180")} />
                    </SidebarMenuButton>
                    {openSubMenus[item.label] && (
                        <SidebarMenuSub>
                        {item.subItems.map(subItem => (
                            <SidebarMenuItem key={subItem.href}>
                               <Link href={subItem.href!} legacyBehavior passHref>
                                <SidebarMenuSubButton isActive={pathname.startsWith(subItem.href!)}>
                                    <subItem.icon/>
                                    <span>{subItem.label}</span>
                                </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                        </SidebarMenuSub>
                    )}
                  </>
                ) : (
                  <Link href={item.href!} legacyBehavior passHref>
                    <SidebarMenuButton
                      isActive={pathname === item.href || (pathname.startsWith(item.href!) && item.href !== (isAdminRoute ? "/admin" : "/dashboard"))}
                      tooltip={{ children: item.label, className: "bg-accent text-accent-foreground" }}
                      className="text-base"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
           <SidebarMenu>
             {secondaryNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={(!!item.href && pathname.startsWith(item.href))}
                    tooltip={{ children: item.label, className: "bg-accent text-accent-foreground" }}
                    className="text-base"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
             ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} className="text-base">
                    <LogOut />
                    <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 shadow-sm">
            <div className="flex-1 flex items-center gap-4">
                 <h1 className="text-xl md:text-2xl font-semibold text-foreground">
                    {mainNavItems.find(item => item.href && (!!item.href && pathname.startsWith(item.href)))?.label ||
                     mainNavItems.find(item => item.subItems?.some(sub => pathname.startsWith(sub.href!)))?.label || 
                     (isAdminRoute ? "Admin" : "BadmintonXP")}
                </h1>
            </div>
            <div className="flex items-center gap-4">
                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                            <Avatar className="h-10 w-10 border-2 border-accent">
                            <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="profile avatar"/>
                            <AvatarFallback>{user.name.substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{user.name}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {user.email}
                            </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/profile">
                                <UserCircle className="mr-2 h-4 w-4" />
                                Profile
                            </Link>
                        </DropdownMenuItem>
                        {user.role === 'admin' && !isAdminRoute && (
                          <DropdownMenuItem asChild>
                              <Link href="/admin">
                                  <Shield className="mr-2 h-4 w-4" />
                                  Admin Panel
                              </Link>
                          </DropdownMenuItem>
                        )}
                         {user.role === 'admin' && isAdminRoute && (
                          <DropdownMenuItem asChild>
                              <Link href="/dashboard">
                                  <Gamepad2 className="mr-2 h-4 w-4" />
                                  Player View
                              </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-transparent pb-20 md:pb-8">
          <div className="container mx-auto max-w-7xl">
            {children}
          </div>
        </main>
         <footer className="hidden md:block border-t bg-background/80 backdrop-blur-sm py-4 px-4 md:px-6 text-center text-sm text-muted-foreground">
            BadmintonXP &copy; {new Date().getFullYear()}. The Badminton Community Game.
        </footer>
      </SidebarInset>
      {isMobile && <MobileBottomNav isAdminRoute={isAdminRoute}/>}
    </SidebarProvider>
  );
}
