'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultMorphFsId = '797d5ca0-e739-46ef-909b-b623c91fe657';
  const redirectTo = searchParams.get('redirectTo') || `/projects/${defaultMorphFsId}`;

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        throw signInErr;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCoopProfileLogin = async (
    profileEmail: string,
    profileName: string,
    roleTitle: string
  ) => {
    const fixedPassword = 'MorphFS2026Verification!';
    setEmail(profileEmail);
    setPassword(fixedPassword);
    setError(null);
    setLoading(true);

    try {
      // 1. Attempt direct sign-in first (accounts are already provisioned with confirmed email)
      let { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: profileEmail,
        password: fixedPassword,
      });

      // 2. If credentials not found or account needs provisioning, use server-side admin API
      if (signInErr) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profileEmail,
            password: fixedPassword,
            fullName: profileName,
          }),
        });

        const regData = await res.json();
        // If created or already exists, attempt final sign-in
        const { error: secondSignInErr } = await supabase.auth.signInWithPassword({
          email: profileEmail,
          password: fixedPassword,
        });

        if (secondSignInErr) throw secondSignInErr;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      console.error('Co-op profile login error:', err);
      setError(err.message || 'Co-op profile authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/10 border border-purple-500/30 text-purple-400 shadow-inner">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-1">
              WINDOWS EDITION • PFE CAPSTONE
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              MorphFS Verification Platform
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Copy-on-Write Filesystem Verification, Crash Consistency & Co-Op Defense Portal
          </p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold text-zinc-100">
              Sign In to MorphFS Workspace
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Access the 10 verification suites, invariant model checkers, and jury sign-off gates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@morphfs.dev"
                  required
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-zinc-300">
                    Password
                  </label>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="bg-zinc-950 border-zinc-800 text-xs font-mono"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 font-medium bg-purple-600 hover:bg-purple-500 text-white"
                isLoading={loading}
              >
                Sign In to MorphFS <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-zinc-900 px-2 text-zinc-500 font-mono">
                  Fast Co-Op Access Profiles
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  handleCoopProfileLogin(
                    'ahmed@morphfs.dev',
                    'Ahmed Affes',
                    'Lead Systems Architect'
                  )
                }
                disabled={loading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/20 hover:bg-purple-900/40 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center text-xs font-mono">
                    AA
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">
                      Ahmed Affes
                    </div>
                    <div className="text-[10px] text-purple-400 font-mono">
                      Lead Systems Architect & Core Author
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  Author
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCoopProfileLogin(
                    'friend@morphfs.dev',
                    'Systems Co-Author',
                    'Systems Engineering Teammate'
                  )
                }
                disabled={loading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-blue-500/30 bg-blue-950/20 hover:bg-blue-900/40 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs font-mono">
                    CO
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">
                      Engineering Co-Author (Friend)
                    </div>
                    <div className="text-[10px] text-blue-400 font-mono">
                      MFP Sync & Windows Shell Co-Developer
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  Co-Op
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCoopProfileLogin(
                    'professor@morphfs.dev',
                    'Academic Advisor',
                    'Academic Jury Evaluator'
                  )
                }
                disabled={loading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/40 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-emerald-600/20 text-emerald-400 font-bold flex items-center justify-center text-xs font-mono">
                    PR
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">
                      Prof. Academic Advisor
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono">
                      PFE Defense Evaluator & Jury Sign-off
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Jury
                </span>
              </button>
            </div>

            <div className="pt-2 text-center text-xs text-zinc-500">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-purple-400 hover:underline font-medium">
                Create Account
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-zinc-600 font-mono">
          MorphFS Architecture • Invariant Verified • Windows Shell & Journaling
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 font-mono text-xs">
          Loading MorphFS authentication portal...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
