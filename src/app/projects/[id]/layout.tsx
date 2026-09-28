import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Project, UserProfile, ProjectRole } from '@/lib/types';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const projectQuery = isUuid
    ? supabase.from('projects').select('*').eq('id', id).maybeSingle()
    : supabase.from('projects').select('*').ilike('key', id).maybeSingle();

  // Run auth check and project query concurrently
  const [
    { data: { user } },
    { data: project, error: projectError }
  ] = await Promise.all([
    supabase.auth.getUser(),
    projectQuery
  ]);

  if (!user) {
    redirect(`/login?redirectTo=/projects/${id}`);
  }

  if (projectError || !project) {
    notFound();
  }

  // Fetch switcher projects, user role, and user profile concurrently
  const [allProjectsRes, memberDataRes, profileRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('project_members').select('role').eq('project_id', project.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
  ]);

  const allProjects = allProjectsRes.data || [];
  const memberData = memberDataRes.data;
  const profile = profileRes.data;

  const userRole: ProjectRole = (memberData?.role as ProjectRole) || 'admin';

  const userProfile: UserProfile = profile || {
    id: user.id,
    email: user.email || 'user@testmanager.dev',
    full_name: user.user_metadata?.full_name || 'QA Engineer',
    role: 'tester',
    avatar_url: null,
    created_at: new Date().toISOString(),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar
        currentProject={project as Project}
        projects={(allProjects as Project[]) || []}
        userRole={userRole}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          currentProject={project as Project}
          user={userProfile}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-50/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
