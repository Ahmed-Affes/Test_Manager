'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  Mail,
  Key,
  Save,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export default function UserProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);
  const [projectCount, setProjectCount] = React.useState<number>(0);

  // Profile Form state
  const [fullName, setFullName] = React.useState('');
  const [roleTitle, setRoleTitle] = React.useState('');
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileSuccess, setProfileSuccess] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const fetchUserData = React.useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr || !authUser) {
        router.push('/login?redirectTo=/profile');
        return;
      }

      setUser(authUser);

      // Fetch public profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (prof) {
        setProfile(prof);
        setFullName(prof.full_name || authUser.user_metadata?.full_name || '');
        setRoleTitle(prof.role_title || 'QA Engineer');
      } else {
        setFullName(authUser.user_metadata?.full_name || '');
        setRoleTitle('QA Engineer');
      }

      // Count user's projects
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      setProjectCount(count || 0);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  React.useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileSuccess(false);
    setProfileError(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim(),
          role_title: roleTitle.trim() || 'Software Engineer',
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Also update auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      fetchUserData();
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    setPasswordSuccess(false);
    setPasswordError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs text-zinc-400 font-mono">Loading profile details...</p>
        </div>
      </div>
    );
  }

  const initialLetter = (fullName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Navbar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Projects</span>
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-500">
              <User className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">User Account & Profile</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="xs"
            variant="ghost"
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-rose-400 gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* User Identity Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-sm">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold font-mono shadow-lg shadow-blue-500/20 shrink-0">
            {initialLetter}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-zinc-100">
                {fullName || 'QA Engineer'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {roleTitle || 'Tester'}
              </span>
            </div>

            <p className="text-xs text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 font-mono">
              <Mail className="h-3.5 w-3.5 text-zinc-500" />
              {user?.email}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Joined {formatDate(user?.created_at || profile?.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {projectCount} Active Projects
              </span>
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information Form */}
          <Card className="border-zinc-800 bg-zinc-900/30">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-sm flex items-center gap-2 text-zinc-100">
                <Briefcase className="h-4 w-4 text-blue-400" />
                Personal Profile
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Update how your name and role appear across test plans, runs, and sign-offs
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                {profileSuccess && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Profile saved successfully!</span>
                  </div>
                )}
                {profileError && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Display Name
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Role Title
                  </label>
                  <Input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. Senior QA Engineer / Test Architect"
                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Account Email (Read-only)
                  </label>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-zinc-950/60 border-zinc-800/60 text-zinc-500 font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={savingProfile}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security & Password */}
          <Card className="border-zinc-800 bg-zinc-900/30">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-sm flex items-center gap-2 text-zinc-100">
                <Key className="h-4 w-4 text-purple-400" />
                Security Credentials
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Change your authentication password to keep your account safe
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
                {passwordSuccess && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Password updated successfully!</span>
                  </div>
                )}
                {passwordError && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                </div>

                <div className="pt-8 flex justify-end">
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    isLoading={savingPassword}
                    className="gap-1.5 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                  >
                    <Key className="h-3.5 w-3.5" />
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
