import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PropertyDetail } from '@/types/property';
import type { UWInputs, UWOutputs } from '@/types/underwriting';
import type { UWAction } from '../types';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';
import type { UWSubPage } from '@/store/underwritingStageStore';
import { UWSummaryPage } from '../UWSummaryPage';
import { UWAssumptionsPage } from '../UWAssumptionsPage';
import { UWProformaPage } from '../UWProformaPage';
import { UWCashFlowsPage } from '../UWCashFlowsPage';
import { UWDetailSchedulesPage } from '../UWDetailSchedulesPage';
import { UWT12MappingPage } from '../UWT12MappingPage';
import { SplitDivider } from './SplitDivider';

export interface StageCanvasProps {
  property: PropertyDetail;
  inputs: UWInputs;
  outputs: UWOutputs | null;
  dispatch: React.Dispatch<UWAction>;
  isComputing: boolean;
}

const FLIGHT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PANE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 26,
  layout: { duration: 0.42, ease: FLIGHT_EASE },
};

export function StageCanvas({
  property,
  inputs,
  outputs,
  dispatch,
  isComputing,
}: StageCanvasProps) {
  const activePane1 = useUnderwritingStageStore((s) => s.activePane1);
  const activePane2 = useUnderwritingStageStore((s) => s.activePane2);
  const splitRatio = useUnderwritingStageStore((s) => s.splitRatio);
  const pickingSecond = useUnderwritingStageStore((s) => s.pickingSecond);
  const closeSplit = useUnderwritingStageStore((s) => s.closeSplit);
  const splitMode = activePane2 !== null;
  const containerRef = useRef<HTMLDivElement>(null);

  const sharedPageProps = { inputs, outputs, dispatch, isComputing };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full items-stretch overflow-hidden p-4"
      >
        <motion.div
          layoutId={`uw-pane-${activePane1}`}
          animate={{
            width: splitMode
              ? `calc(${splitRatio * 100}% - 4px)`
              : '100%',
          }}
          transition={PANE_TRANSITION}
          className="relative h-full min-w-0 overflow-auto"
        >
          <div className="glass rounded-2xl border border-white/10 p-10 min-h-full">
            <PaneContent
              pageId={activePane1}
              property={property}
              {...sharedPageProps}
            />
          </div>
        </motion.div>

        <AnimatePresence>
          {splitMode && activePane2 !== null && (
            <>
              <SplitDivider containerRef={containerRef} />
              <motion.div
                key="uw-pane-2"
                layoutId={`uw-pane-${activePane2}`}
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: `calc(${(1 - splitRatio) * 100}% - 4px)`,
                  opacity: 1,
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={PANE_TRANSITION}
                className="relative h-full min-w-0 overflow-auto"
              >
                <div className="glass rounded-2xl border border-white/10 p-10 min-h-full relative">
                  <button
                    type="button"
                    onClick={closeSplit}
                    aria-label="Close split pane"
                    className="absolute top-3 right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/70 transition-colors [transition-duration:180ms] hover:border-white/25 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <PaneContent
                    pageId={activePane2}
                    property={property}
                    {...sharedPageProps}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {pickingSecond && (
          <motion.div
            key="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-none absolute inset-0 bg-black/30 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface PaneContentProps {
  pageId: UWSubPage;
  property: PropertyDetail;
  inputs: UWInputs;
  outputs: UWOutputs | null;
  dispatch: React.Dispatch<UWAction>;
  isComputing: boolean;
}

function PaneContent({
  pageId,
  property,
  inputs,
  outputs,
  dispatch,
  isComputing,
}: PaneContentProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageId}
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -2 }}
        transition={{ duration: 0.28, ease: FLIGHT_EASE }}
      >
        <ActivePage
          page={pageId}
          property={property}
          inputs={inputs}
          outputs={outputs}
          dispatch={dispatch}
          isComputing={isComputing}
        />
      </motion.div>
    </AnimatePresence>
  );
}

interface ActivePageProps {
  page: UWSubPage;
  property: PropertyDetail;
  inputs: UWInputs;
  outputs: UWOutputs | null;
  dispatch: React.Dispatch<UWAction>;
  isComputing: boolean;
}

function ActivePage({
  page,
  property,
  inputs,
  outputs,
  dispatch,
  isComputing,
}: ActivePageProps) {
  const shared = { inputs, outputs, dispatch, isComputing };
  switch (page) {
    case 'summary':
      return <UWSummaryPage {...shared} />;
    case 'assumptions':
      return <UWAssumptionsPage {...shared} />;
    case 'proforma':
      return <UWProformaPage {...shared} />;
    case 'cashflows':
      return <UWCashFlowsPage {...shared} />;
    case 'schedules':
      return <UWDetailSchedulesPage {...shared} />;
    case 't12mapping':
      return <UWT12MappingPage {...shared} property={property} />;
    default:
      return null;
  }
}
