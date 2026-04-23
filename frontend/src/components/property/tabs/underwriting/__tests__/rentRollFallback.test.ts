/**
 * Regression: property_id=10 "Sixty 11th" produced Y1 cap rate of -45.53% because
 * rent roll extraction populates property.rr_* aggregates but never seeds the
 * PropertyUnitMix table, leaving the UW engine's unit_mix input empty.
 *
 * seedInputsFromProperty now synthesizes a single aggregate unit_mix row from
 * rr_* fields when property.unit_mix is empty. These tests lock that behavior
 * in and verify the detection helpers used by the Assumptions-tab warning banner.
 *
 * Remove these tests together with the fallback when issue #170 lands:
 * https://github.com/grshapiro2001-crypto/astra-cre-platform/issues/170
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PropertyDetail, UnitMixItem } from '@/types/property';
import {
  isRentRollFallbackActive,
  rentRollFallbackMissingSqft,
} from '../rentRollFallback';
import { seedInputsFromProperty } from '../../UnderwritingTab';

function makeProperty(overrides: Partial<PropertyDetail>): PropertyDetail {
  return {
    id: 10,
    deal_name: 'Test',
    document_type: 'rent_roll',
    ...overrides,
  } as PropertyDetail;
}

function makeUnitMixItem(overrides: Partial<UnitMixItem>): UnitMixItem {
  return {
    id: 1,
    floorplan_name: null,
    unit_type: null,
    bedroom_count: null,
    bathroom_count: null,
    num_units: null,
    unit_sf: null,
    in_place_rent: null,
    proforma_rent: null,
    proforma_rent_psf: null,
    renovation_premium: null,
    ...overrides,
  };
}

describe('isRentRollFallbackActive', () => {
  it('returns false when property is null/undefined', () => {
    expect(isRentRollFallbackActive(null)).toBe(false);
    expect(isRentRollFallbackActive(undefined)).toBe(false);
  });

  it('returns false when OM-sourced unit_mix exists', () => {
    const p = makeProperty({
      rr_total_units: 100,
      unit_mix: [
        makeUnitMixItem({
          floorplan_name: 'A1',
          unit_type: '1BR/1BA',
          num_units: 50,
          unit_sf: 700,
          in_place_rent: 1500,
          proforma_rent: 1600,
        }),
      ],
    });
    expect(isRentRollFallbackActive(p)).toBe(false);
  });

  it('returns false when no rent roll data is present', () => {
    expect(isRentRollFallbackActive(makeProperty({}))).toBe(false);
    expect(isRentRollFallbackActive(makeProperty({ rr_total_units: 0 }))).toBe(false);
  });

  it('returns true when rr_total_units > 0 and unit_mix is empty', () => {
    const p = makeProperty({ rr_total_units: 332, unit_mix: [] });
    expect(isRentRollFallbackActive(p)).toBe(true);
  });
});

describe('rentRollFallbackMissingSqft', () => {
  it('is true only when fallback is active AND rr_avg_sqft is null', () => {
    expect(
      rentRollFallbackMissingSqft(
        makeProperty({ rr_total_units: 100, unit_mix: [], rr_avg_sqft: null }),
      ),
    ).toBe(true);

    expect(
      rentRollFallbackMissingSqft(
        makeProperty({ rr_total_units: 100, unit_mix: [], rr_avg_sqft: 850 }),
      ),
    ).toBe(false);

    expect(
      rentRollFallbackMissingSqft(makeProperty({ rr_total_units: 0 })),
    ).toBe(false);
  });
});

describe('seedInputsFromProperty — rent-roll-only fallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('synthesizes one aggregate unit_mix row from rr_* when PropertyUnitMix is empty', () => {
    // Shape modeled on Sixty 11th (property_id=10): rent roll data only, no OM unit mix.
    const p = makeProperty({
      id: 10,
      unit_mix: [],
      total_units: null,
      total_residential_sf: null,
      rr_total_units: 332,
      rr_avg_sqft: 850,
      rr_avg_market_rent: 2400,
      rr_avg_in_place_rent: 2250,
    });

    const inputs = seedInputsFromProperty(p);

    expect(inputs.unit_mix).toHaveLength(1);
    expect(inputs.unit_mix[0]).toEqual({
      floorplan: 'Rent Roll Aggregate',
      units: 332,
      sf: 850,
      market_rent: 2400,
      inplace_rent: 2250,
    });
    expect(inputs.total_units).toBe(332);
    expect(inputs.total_sf).toBe(332 * 850);
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });

  it('still emits the row with sf=0 and logs a warning when rr_avg_sqft is null', () => {
    const p = makeProperty({
      id: 10,
      unit_mix: [],
      total_units: null,
      total_residential_sf: null,
      rr_total_units: 100,
      rr_avg_sqft: null,
      rr_avg_market_rent: 2000,
      rr_avg_in_place_rent: 1900,
    });

    const inputs = seedInputsFromProperty(p);

    expect(inputs.unit_mix).toHaveLength(1);
    expect(inputs.unit_mix[0].sf).toBe(0);
    expect(inputs.unit_mix[0].units).toBe(100);
    expect(inputs.total_units).toBe(100);
    // total_sf cannot be derived without rr_avg_sqft — stays 0 (unreliable, banner warns).
    expect(inputs.total_sf).toBe(0);
    const warnMock = vi.mocked(console.warn);
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(String(warnMock.mock.calls[0][0])).toMatch(/rr_avg_sqft is null/);
  });

  it('does not overwrite an existing OM-sourced unit_mix', () => {
    const p = makeProperty({
      unit_mix: [
        makeUnitMixItem({
          floorplan_name: 'A1',
          unit_type: '1BR/1BA',
          num_units: 50,
          unit_sf: 700,
          in_place_rent: 1500,
          proforma_rent: 1600,
        }),
      ],
      rr_total_units: 100,
      rr_avg_market_rent: 2400,
    });

    const inputs = seedInputsFromProperty(p);

    expect(inputs.unit_mix).toHaveLength(1);
    expect(inputs.unit_mix[0].floorplan).toBe('A1');
    expect(inputs.unit_mix[0].units).toBe(50);
    expect(inputs.unit_mix[0].market_rent).toBe(1600);
  });
});
