/**
 * Rent-roll → unit-mix fallback detection.
 *
 * Property-backed check shared by seedInputsFromProperty (UnderwritingTab)
 * and the UI warning banner on UWAssumptionsPage.
 *
 * TODO: Remove this module when rent roll extraction writes to
 * PropertyUnitMix directly with source='rent_roll' tag.
 * See https://github.com/grshapiro2001-crypto/astra-cre-platform/issues/170
 */

import type { PropertyDetail } from '@/types/property';

export function isRentRollFallbackActive(
  property: PropertyDetail | null | undefined,
): boolean {
  if (!property) return false;
  const hasUnitMix = (property.unit_mix?.length ?? 0) > 0;
  const hasRentRoll = (property.rr_total_units ?? 0) > 0;
  return !hasUnitMix && hasRentRoll;
}

export function rentRollFallbackMissingSqft(
  property: PropertyDetail | null | undefined,
): boolean {
  return isRentRollFallbackActive(property) && property?.rr_avg_sqft == null;
}
