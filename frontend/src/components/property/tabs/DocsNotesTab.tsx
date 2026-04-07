/**
 * DocsNotesTab — AI insights CTA, documents, notes, activity log.
 */

import {
  ArrowRight,
  Sparkles,
  FileText,
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyDetail, PropertyDocument } from '@/types/property';
import {
  docBadgeClass,
  docCategoryBadge,
  fmtShortDate,
  GLASS_CARD,
} from './tabUtils';

interface DocsNotesTabProps {
  property: PropertyDetail;
  newNote: string;
  setNewNote: (n: string) => void;
  isSavingNote: boolean;
  onAddNote: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isUploadingDoc: boolean;
  uploadMessage: { text: string; isError: boolean } | null;
  onDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenAIPanel: () => void;
}

// ---------------------------------------------------------------------------
// Activity Log (NEW)
// ---------------------------------------------------------------------------

interface ActivityEntry {
  icon: 'upload' | 'add';
  text: string;
  timestamp: string;
  color: string;
}

function buildActivityLog(property: PropertyDetail): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  // Document uploads
  for (const doc of (property.documents ?? [])) {
    const catLabel = doc.document_category === 'rent_roll' ? 'Rent Roll'
      : doc.document_category === 't12' ? 'T12 financials'
      : doc.document_category === 'om' ? 'Offering Memorandum'
      : doc.document_category === 'bov' ? 'BOV'
      : doc.filename;
    const status = doc.extraction_status === 'completed' ? ' and extracted' : '';
    entries.push({
      icon: 'upload',
      text: `${catLabel} uploaded${status}`,
      timestamp: doc.uploaded_at,
      color: 'bg-blue-500',
    });
  }

  // Original upload
  if (property.uploaded_filename && property.upload_date) {
    entries.push({
      icon: 'upload',
      text: `${property.document_type || 'Document'} uploaded`,
      timestamp: property.upload_date,
      color: 'bg-blue-500',
    });
  }

  // Deal creation (approximate from upload_date or earliest document)
  const createdAt = property.upload_date ?? property.last_analyzed_at;
  if (createdAt) {
    entries.push({
      icon: 'add',
      text: 'Deal created and added to pipeline',
      timestamp: createdAt,
      color: 'bg-emerald-500',
    });
  }

  // Sort by date descending (most recent first)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return entries;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function DocsNotesTab({
  property,
  newNote,
  setNewNote,
  isSavingNote,
  onAddNote,
  fileInputRef,
  isUploadingDoc,
  uploadMessage,
  onDocumentUpload,
  onOpenAIPanel,
}: DocsNotesTabProps) {
  const activityLog = buildActivityLog(property);

  return (
    <div className="space-y-6">
      {/* ─── AI Insights CTA ─── */}
      <div
        className="liquid-glass p-6 cursor-pointer hover:border-white/10 transition-colors"
        onClick={onOpenAIPanel}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shrink-0">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-foreground">AI Insights Available</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Get a back-of-napkin summary, key observations, and investment recommendations based on extracted data.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* ─── Documents ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">Documents</h2>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xlsm,.csv"
              className="hidden"
              onChange={onDocumentUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingDoc}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {isUploadingDoc ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Extracting...</>
              ) : (
                <><Upload className="w-4 h-4" />Upload Document</>
              )}
            </button>
          </div>
        </div>

        {uploadMessage && (
          <div className={`mb-4 p-3 rounded-xl text-sm border ${
            uploadMessage.isError
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-white/5 text-zinc-300 border-white/10'
          }`}>
            {uploadMessage.text}
          </div>
        )}

        <div className={GLASS_CARD + ' space-y-3'}>
          {/* Original OM document */}
          {property.uploaded_filename && !(property.documents ?? []).some(
            (d: PropertyDocument) => d.filename === property.uploaded_filename
          ) && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-foreground text-sm">{property.uploaded_filename}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('px-2 py-0.5 rounded text-2xs font-bold uppercase', docBadgeClass(property.document_type))}>
                    {property.document_type}
                  </span>
                  <span className="text-xs text-muted-foreground">Uploaded {fmtShortDate(property.upload_date)}</span>
                </div>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
            </div>
          )}

          {/* Document records */}
          {(property.documents ?? []).map((doc: PropertyDocument) => {
            const badge = docCategoryBadge(doc.document_category);
            return (
              <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10">
                  {doc.file_type === 'xlsx' ? (
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground text-sm">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn('px-2 py-0.5 rounded text-2xs font-bold uppercase', badge.className)}>
                      {badge.label}
                    </span>
                    {doc.document_date && <span className="text-xs text-muted-foreground">{fmtShortDate(doc.document_date)}</span>}
                    <span className="text-xs text-muted-foreground">Uploaded {fmtShortDate(doc.uploaded_at)}</span>
                  </div>
                  {doc.extraction_status === 'failed' && doc.extraction_summary && (
                    <p className="text-xs mt-1 text-red-400">{doc.extraction_summary}</p>
                  )}
                </div>
                <div className="shrink-0 mt-1">
                  {doc.extraction_status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  {doc.extraction_status === 'processing' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                  {doc.extraction_status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                  {doc.extraction_status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {!property.uploaded_filename && (property.documents ?? []).length === 0 && (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No documents available. Upload a Rent Roll or T-12 Excel file.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Notes ─── */}
      <div>
        <h2 className="font-display text-lg font-bold mb-4 text-foreground">Notes</h2>
        <div className={GLASS_CARD}>
          <div className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this property..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm glass border border-white/[0.04] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-white/20 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={onAddNote}
                disabled={!newNote.trim() || isSavingNote}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingNote ? (
                  <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Saving...</>
                ) : (
                  'Add Note'
                )}
              </button>
            </div>
          </div>
          {property.pipeline_notes ? (
            <div className="space-y-3 mt-4">
              {property.pipeline_notes.split('\n\n').map((note, idx) => (
                <div key={idx} className="p-3 rounded-lg glass border border-white/[0.04]">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <StickyNote className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notes yet. Add a note above to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Activity Log (NEW) ─── */}
      {activityLog.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-bold mb-4 text-foreground">Activity Log</h2>
          <div className={GLASS_CARD}>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-white/10" />

              <div className="space-y-5">
                {activityLog.map((entry, i) => {
                  const IconComp = entry.icon === 'upload' ? Upload : CheckCircle;
                  return (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10', entry.color)}>
                        <IconComp className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-foreground">{entry.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtShortDate(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
