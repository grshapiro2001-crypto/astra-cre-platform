import { AnimatePresence, motion } from 'framer-motion';
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

export interface StageCanvasProps {
  property: PropertyDetail;
  inputs: UWInputs;
  outputs: UWOutputs | null;
  dispatch: React.Dispatch<UWAction>;
  isComputing: boolean;
}

export function StageCanvas({
  property,
  inputs,
  outputs,
  dispatch,
  isComputing,
}: StageCanvasProps) {
  const activePane1 = useUnderwritingStageStore((s) => s.activePane1);

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="glass rounded-2xl border border-white/10 p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePane1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ActivePage
              page={activePane1}
              property={property}
              inputs={inputs}
              outputs={outputs}
              dispatch={dispatch}
              isComputing={isComputing}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
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
