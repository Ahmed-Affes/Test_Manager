'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Camera, UploadCloud, Search, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery';
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader';
import { Modal } from '@/components/ui/modal';
import { Evidence } from '@/lib/types';

export default function EvidencePage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [evidenceList, setEvidenceList] = React.useState<Evidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [isUploaderOpen, setIsUploaderOpen] = React.useState(false);

  const fetchEvidence = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id').ilike('key', projectId).single();
        if (p) pId = p.id;
      }

      const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEvidenceList(data as Evidence[]);
      }
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const filtered = evidenceList.filter((e) =>
    e.original_file_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.description && e.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Camera className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Evidence Vault (fsck / Hex Dumps)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Central repository of screenshots, failure stack traces, server logs, and test artifacts.
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => setIsUploaderOpen(true)}>
          <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
          Upload Evidence Artifact
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search evidence by filename or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          {filtered.length} {filtered.length === 1 ? 'artifact' : 'artifacts'}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-500 font-mono">
          Loading evidence vault...
        </div>
      ) : (
        <EvidenceGallery
          evidenceList={filtered}
          onDeleteEvidence={async (evidenceId: string) => {
            await supabase.from('evidence').delete().eq('id', evidenceId);
            await fetchEvidence();
          }}
        />
      )}

      <Modal
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        title="Upload Test Evidence & Artifacts"
        description="Attach screenshots, failure logs, and artifacts to this project's evidence vault."
        size="lg"
      >
        <div className="pt-2">
          <EvidenceUploader
            projectId={projectId}
            onUploadSuccess={() => {
              setIsUploaderOpen(false);
              fetchEvidence();
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
