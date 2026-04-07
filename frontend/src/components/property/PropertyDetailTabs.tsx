/**
 * PropertyDetailTabs — Tab bar + content orchestrator for property detail page.
 * Manages active tab state and renders the correct tab component.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import type { DealScoreResult } from '@/services/scoringService';
import type { FinancialPeriodKey, FinancialViewMode } from './tabs/tabUtils';

import { OverviewTab } from './tabs/OverviewTab';
import { FinancialsTab } from './tabs/FinancialsTab';
import { UnderwritingTab } from './tabs/UnderwritingTab';
import { UnitMixTab } from './tabs/UnitMixTab';
import { StackingModelTab } from './tabs/StackingModelTab';
import { ComparablesTab } from './tabs/ComparablesTab';
import { DocsNotesTab } from './tabs/DocsNotesTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'financials', label: 'Financials' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'unit-mix', label: 'Unit Mix' },
  { key: 'stacking', label: 'Stacking Model' },
  { key: 'comparables', label: 'Comparables' },
  { key: 'docs-notes', label: 'Docs & Notes' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export interface PropertyDetailTabsProps {
  property: PropertyDetail;
  dealScore: DealScoreResult | null;
  // Financial state (lifted from parent)
  financialPeriod: FinancialPeriodKey;
  setFinancialPeriod: (p: FinancialPeriodKey) => void;
  financialView: FinancialViewMode;
  setFinancialView: (v: FinancialViewMode) => void;
  // Pricing state
  selectedTierIdx: number;
  setSelectedTierIdx: (i: number) => void;
  capRateSlider: number;
  setCapRateSlider: (v: number) => void;
  pricingGuidance: number;
  setPricingGuidance: (v: number) => void;
  isSavingGuidance: boolean;
  guidanceSaved: boolean;
  savedGuidanceValue: number;
  onSaveGuidance: () => void;
  // Rent comp state
  rentCompTab: string;
  setRentCompTab: (t: string) => void;
  // Notes state
  newNote: string;
  setNewNote: (n: string) => void;
  isSavingNote: boolean;
  onAddNote: () => void;
  // Document upload
  fileInputRef: React.RefObject<HTMLInputElement>;
  isUploadingDoc: boolean;
  uploadMessage: { text: string; isError: boolean } | null;
  onDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // AI panel
  onOpenAIPanel: () => void;
  // Navigation
  navigate: (path: string) => void;
  // Property setter (for docs/notes updates)
  setProperty: React.Dispatch<React.SetStateAction<PropertyDetail | null>>;
}

export function PropertyDetailTabs(props: PropertyDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  return (
    <div>
      {/* ─── Tab Bar ─── */}
      <div className="sticky top-[calc(4rem+73px)] z-10 bg-background/90 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <nav className="overflow-x-auto whitespace-nowrap -mb-px" role="tablist">
            <div className="flex" style={{ gap: 28 }}>
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'py-3 font-sans text-[13px] font-normal tracking-wide border-b-2 transition-colors whitespace-nowrap',
                    activeTab === tab.key
                      ? 'text-white border-white'
                      : 'text-muted-foreground border-transparent hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {activeTab === 'overview' && (
              <OverviewTab
                property={props.property}
                dealScore={props.dealScore}
                financialPeriod={props.financialPeriod}
              />
            )}
            {activeTab === 'financials' && (
              <FinancialsTab
                property={props.property}
                financialPeriod={props.financialPeriod}
                setFinancialPeriod={props.setFinancialPeriod}
                financialView={props.financialView}
                setFinancialView={props.setFinancialView}
                navigate={props.navigate}
              />
            )}
            {activeTab === 'underwriting' && (
              <UnderwritingTab
                property={props.property}
              />
            )}
            {activeTab === 'unit-mix' && (
              <UnitMixTab property={props.property} />
            )}
            {activeTab === 'stacking' && (
              <StackingModelTab property={props.property} />
            )}
            {activeTab === 'comparables' && (
              <ComparablesTab
                property={props.property}
                rentCompTab={props.rentCompTab}
                setRentCompTab={props.setRentCompTab}
              />
            )}
            {activeTab === 'docs-notes' && (
              <DocsNotesTab
                property={props.property}
                newNote={props.newNote}
                setNewNote={props.setNewNote}
                isSavingNote={props.isSavingNote}
                onAddNote={props.onAddNote}
                fileInputRef={props.fileInputRef}
                isUploadingDoc={props.isUploadingDoc}
                uploadMessage={props.uploadMessage}
                onDocumentUpload={props.onDocumentUpload}
                onOpenAIPanel={props.onOpenAIPanel}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
