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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/projects/${id}`);
  }

  // Fetch current project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // Fetch all projects for switcher
  const { data: allProjects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch user role for this project
  const { data: memberData } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .single();

  const userRole: ProjectRole = (memberData?.role as ProjectRole) || 'admin';

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const userProfile: UserProfile = profile || {
    id: user.id,
    email: user.email || 'user@testmanager.dev',
    full_name: user.user_metadata?.full_name || 'QA Engineer',
    role: 'tester',
    avatar_url: null,
    created_at: new Date().toISOString(),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
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

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
