/**
 * SaveComparisonModal — Save comparison to database (BUG-006 fix)
 * Previously called dealFolderService.createFolder() — now uses savedComparisonService
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { savedComparisonService } from '@/services/savedComparisonService';
import type { PropertyComparisonItem } from './types';

interface SaveComparisonModalProps {
  open: boolean;
  onClose: () => void;
  properties: PropertyComparisonItem[];
  subjectId: number | null;
  presetKey: string;
}

export function SaveComparisonModal({
  open,
  onClose,
  properties,
  subjectId,
  presetKey,
}: SaveComparisonModalProps) {
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a comparison name');
      return;
    }

    setIsSaving(true);
    try {
      const propertyIds = properties.map((p) => p.id);
      const tagList = tags.trim()
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;

      await savedComparisonService.create({
        name: name.trim(),
        property_ids: propertyIds,
        subject_property_id: subjectId,
        tags: tagList,
        notes: notes.trim() || undefined,
        preset_key: presetKey,
      });

      toast.success('Comparison saved');
      setName('');
      setTags('');
      setNotes('');
      onClose();
    } catch {
      toast.error('Failed to save comparison');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="liquid-glass w-full max-w-md p-6 mx-4">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-white mb-1">
          Save Comparison
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {properties.length} properties compared
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-zinc-400">
              Comparison Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Southeast Value-Add Pipeline"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-1 focus:ring-white/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block text-zinc-400">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., Georgia, Value-Add, 2024"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-1 focus:ring-white/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block text-zinc-400">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this comparison..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-1 focus:ring-white/10"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-black bg-white hover:bg-zinc-200 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Comparison'}
          </button>
        </div>
      </div>
    </div>
  );
}
