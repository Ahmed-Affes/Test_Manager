import { redirect } from 'next/navigation';

export default async function CaseRedirectPage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>;
}) {
  const { id, caseId } = await params;
  redirect(`/projects/${id}/tests/${caseId}`);
}
