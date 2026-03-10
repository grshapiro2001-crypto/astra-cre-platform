/**
 * StackingModelTab — Thin wrapper around the existing StackingSection component.
 */

import type { PropertyDetail } from '@/types/property';
import { StackingSection } from '@/components/stacking/StackingSection';

interface StackingModelTabProps {
  property: PropertyDetail;
}

export function StackingModelTab({ property }: StackingModelTabProps) {
  return (
    <div>
      <StackingSection property={property} />
    </div>
  );
}
