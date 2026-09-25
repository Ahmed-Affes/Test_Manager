import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Find MorphFS project or fallback to first project
    const { data: morphProject } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', '%MorphFS%')
      .limit(1)
      .maybeSingle();

    if (morphProject) {
      redirect(`/projects/${morphProject.id}`);
    }

    const { data: firstProject } = await supabase
      .from('projects')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (firstProject) {
      redirect(`/projects/${firstProject.id}`);
    }

    redirect('/projects');
  } else {
    redirect('/login');
  }
}
