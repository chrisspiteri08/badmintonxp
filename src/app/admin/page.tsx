
"use client";
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Shield, Puzzle, BarChart3, Settings, UserPlus, PlusCircle, FileEdit } from "lucide-react";

const adminStats = [
  { title: "Total Users", value: "1,250", icon: Users, color: "text-blue-500", href: "/admin/users" },
  { title: "Total Teams", value: "85", icon: Shield, color: "text-green-500", href: "/admin/teams" },
  { title: "Active Challenges", value: "22", icon: Puzzle, color: "text-yellow-500", href: "/admin/challenges" },
  { title: "Reports Pending", value: "3", icon: FileEdit, color: "text-red-500", href: "/admin/reports" },
];

const quickActions = [
    { label: "Add New User", icon: UserPlus, href: "/admin/users/new" },
    { label: "Create Team", icon: PlusCircle, href: "/admin/teams/new" },
    { label: "Add Challenge", icon: Puzzle, href: "/admin/challenges/new" },
    { label: "System Settings", icon: Settings, href: "/admin/settings" },
]

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-primary flex items-center"><BarChart3 className="h-10 w-10 mr-3 text-accent" />Admin Overview</CardTitle>
          <CardDescription className="text-lg">Manage users, teams, challenges, and system settings for BadmintonXP.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {adminStats.map(stat => (
          <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <Button variant="link" asChild className="p-0 h-auto text-sm text-accent">
                  <Link href={stat.href}>View Details</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Quick Actions</CardTitle>
          <CardDescription>Perform common administrative tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map(action => (
            <Button key={action.label} variant="outline" asChild className="h-auto py-4 flex flex-col items-center justify-center gap-2 text-base border-primary hover:bg-primary/10 text-primary">
                <Link href={action.href}>
                    <action.icon className="h-8 w-8 mb-1" />
                    {action.label}
                </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-primary">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>New user 'PlayerX123' registered.</li>
                    <li>Team 'Alpha Shuttlers' created by 'CaptainSmash'.</li>
                    <li>Challenge 'Weekend Warrior Quiz' published.</li>
                    <li>Report received for user 'ToxicPlayer01'.</li>
                </ul>
            </CardContent>
        </Card>
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-primary">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="text-green-600 font-semibold">All systems operational.</p>
                <p className="text-sm text-muted-foreground">Database Connections: Healthy</p>
                <p className="text-sm text-muted-foreground">API Latency: 50ms</p>
                <p className="text-sm text-muted-foreground">Last Backup: Today, 03:00 AM</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

