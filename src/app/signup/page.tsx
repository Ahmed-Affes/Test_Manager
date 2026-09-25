'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SignUpPage() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Registration failed');
      }

      // Automatically sign in with credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        setSuccess('Account created successfully! Redirecting to sign in...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
        return;
      }

      router.push('/projects');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500 shadow-inner">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            TEST MANAGER
          </h1>
          <p className="text-xs text-zinc-400">
            Create Verification Engineer Account
          </p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold text-zinc-100">
              Create Quality Engineering Account
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Join your engineering organization to collaborate on test suites and quality assurance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                {success}
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Full Name
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Corporate Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@company.com"
                  required
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="bg-zinc-950 border-zinc-800 text-xs font-mono"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 font-medium"
                isLoading={loading}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Register Account
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-400 hover:underline font-medium">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
