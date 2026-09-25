'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AuditRedirectPage() {
  const params = useParams();
  const router = useRouter();

  React.useEffect(() => {
    if (params.id) {
      router.replace(`/projects/${params.id}/activity`);
    }
  }, [params.id, router]);

  return (
    <div className="p-12 text-center text-xs text-zinc-500 font-mono">
      Redirecting to project activity & audit trail...
    </div>
  );
}
