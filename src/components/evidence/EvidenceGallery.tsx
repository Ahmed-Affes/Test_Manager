'use client';

import * as React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Trash2,
  Eye,
  Paperclip,
} from 'lucide-react';
import { Evidence } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';

interface EvidenceGalleryProps {
  evidenceList: Evidence[];
  onDeleteEvidence?: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export function EvidenceGallery({
  evidenceList,
  onDeleteEvidence,
  readOnly = false,
}: EvidenceGalleryProps) {
  const [selectedItem, setSelectedItem] = React.useState<Evidence | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [textContent, setTextContent] = React.useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);

  const supabase = createClient();

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('evidence').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleOpenPreview = async (item: Evidence) => {
    setSelectedItem(item);
    setIsLoadingPreview(true);
    setTextContent(null);

    const url = getPublicUrl(item.file_path);
    setPreviewUrl(url);

    // If it's a text/log file, fetch and display inline
    const fileName = item.file_name || item.original_file_name || '';
    if (
      item.file_type.includes('text') ||
      item.file_type.includes('json') ||
      fileName.endsWith('.log') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.har')
    ) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const text = await resp.text();
          setTextContent(text);
        }
      } catch (err) {
        console.error('Failed to load text preview:', err);
      }
    }

    setIsLoadingPreview(false);
  };

  if (!evidenceList || evidenceList.length === 0) {
    return (
      <div className="p-4 text-center border border-dashed rounded-lg border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        No verification evidence attached.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {evidenceList.map((item) => {
          const isImage = item.file_type.startsWith('image/');
          const fileUrl = getPublicUrl(item.file_path);

          return (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {isImage ? (
                      <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={item.file_name}>
                      {item.file_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(item)}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={fileUrl}
                      download={item.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {!readOnly && onDeleteEvidence && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvidence(item.id)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {item.caption && (
                  <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {item.caption}
                  </p>
                )}

                {/* Thumbnail if image */}
                {isImage && (
                  <div
                    onClick={() => handleOpenPreview(item)}
                    className="mt-2 h-24 w-full rounded border border-zinc-100 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-950 cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl}
                      alt={item.caption || item.file_name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>{item.file_size_bytes ? `${(item.file_size_bytes / 1024).toFixed(0)} KB` : 'Unknown size'}</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          size="xl"
          title={
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-zinc-400" />
              <span>{selectedItem.file_name}</span>
            </div>
          }
          description={selectedItem.caption || `Uploaded ${formatDate(selectedItem.created_at)}`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto">
            {selectedItem.file_type.startsWith('image/') && previewUrl && (
              <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={selectedItem.caption || selectedItem.file_name}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
            )}

            {textContent !== null && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200 overflow-x-auto whitespace-pre leading-relaxed">
                {textContent}
              </div>
            )}

            {!selectedItem.file_type.startsWith('image/') && textContent === null && !isLoadingPreview && (
              <div className="p-8 text-center border border-dashed rounded-lg border-zinc-200 dark:border-zinc-800 space-y-3">
                <FileText className="h-8 w-8 text-zinc-400 mx-auto" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Binary or preview-incompatible file format ({selectedItem.file_type}).
                </p>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={selectedItem.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Download File
                    </Button>
                  </a>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
