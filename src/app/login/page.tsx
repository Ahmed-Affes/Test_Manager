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
  const redirectTo = searchParams.get('redirectTo') || '/projects';

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

  const handleDemoLogin = async () => {
    setEmail('demo.lead@testmanager.dev');
    setPassword('TestingVerification2026!');
    setError(null);
    setLoading(true);

    try {
      // First try to sign in
      let { error: signInErr } = await supabase.auth.signInWithPassword({
        email: 'demo.lead@testmanager.dev',
        password: 'TestingVerification2026!',
      });

      // If user doesn't exist, sign them up on the fly
      if (signInErr && signInErr.message.includes('Invalid login credentials')) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: 'demo.lead@testmanager.dev',
          password: 'TestingVerification2026!',
          options: {
            data: {
              full_name: 'Lead Test Architect',
            },
          },
        });
        if (signUpErr) throw signUpErr;

        // Sign in after signup
        const { error: secondSignInErr } = await supabase.auth.signInWithPassword({
          email: 'demo.lead@testmanager.dev',
          password: 'TestingVerification2026!',
        });
        if (secondSignInErr) throw secondSignInErr;
      } else if (signInErr) {
        throw signInErr;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Demo authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500 shadow-inner">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            TEST MANAGER
          </h1>
          <p className="text-xs text-zinc-400">
            Software Verification & Quality Assurance Platform
          </p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold text-zinc-100">
              Sign In to Verification Workspace
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Enter your corporate credentials to access test suites and audit records
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
                  placeholder="qa.lead@company.com"
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
                className="w-full mt-2 font-medium"
                isLoading={loading}
              >
                Sign In <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-zinc-900 px-2 text-zinc-500 font-mono">
                  Or One-Click Access
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full border-zinc-700 bg-zinc-950/60 hover:bg-zinc-800 text-xs text-zinc-300 gap-2"
            >
              <KeyRound className="h-3.5 w-3.5 text-blue-400" />
              Sign In as Demo Lead Architect
            </Button>

            <div className="pt-2 text-center text-xs text-zinc-500">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-blue-400 hover:underline font-medium">
                Create Account
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-zinc-600 font-mono">
          Immutable Testing Fidelity • RLS Secured • Audit Compliant
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
          Loading authentication portal...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
