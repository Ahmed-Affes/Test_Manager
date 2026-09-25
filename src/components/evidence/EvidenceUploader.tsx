'use client';

import * as React from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

interface EvidenceUploaderProps {
  projectId: string;
  testRunId?: string;
  issueId?: string;
  testStepId?: string;
  onUploadSuccess: (evidenceData: {
    file_name: string;
    file_path: string;
    file_type: string;
    file_size_bytes: number;
    caption: string;
    test_run_id?: string;
    issue_id?: string;
    test_step_id?: string;
  }) => void;
}

export function EvidenceUploader({
  projectId,
  testRunId,
  issueId,
  testStepId,
  onUploadSuccess,
}: EvidenceUploaderProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      // Upload to Supabase Storage bucket 'evidence'
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('evidence')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      onUploadSuccess({
        file_name: selectedFile.name,
        file_path: uploadData.path,
        file_type: selectedFile.type || 'application/octet-stream',
        file_size_bytes: selectedFile.size,
        caption: caption.trim(),
        test_run_id: testRunId,
        issue_id: issueId,
        test_step_id: testStepId,
      });

      setSelectedFile(null);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Evidence upload error:', err);
      setErrorMsg(err.message || 'Failed to upload evidence');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-950'
          }`}
        >
          <Upload className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            Drop screenshots, logs, video, HAR or terminal output
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            or click to browse from your device
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              {selectedFile.type.startsWith('image/') ? (
                <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-amber-500 shrink-0" />
              )}
              <div className="truncate">
                <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'file'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSelectedFile(null)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">
              Caption / Context
            </label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Failure screenshot showing 500 error toast on submit"
              className="text-xs h-8"
            />
          </div>

          {errorMsg && (
            <p className="text-rose-500 text-[11px]">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="primary"
              onClick={handleUpload}
              isLoading={isUploading}
              className="gap-1"
            >
              <Upload className="h-3 w-3" />
              Upload Evidence
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
