/**
 * Shared unit color utilities — hex-string versions of filter color helpers
 * used by both StackingViewer3D (via THREE.Color wrapper) and FloorPlanOverlay.
 */
import type { RentRollUnit, StackingFilterType } from '../../types/property';

// ─── Color constants ────────────────────────────────────────────────────────

const OCCUPIED = '#7C3AED';
const VACANT = '#F43F5E';
const UNKNOWN = '#3F3F5A';
const NO_DATA = '#6B7280';

const EXPIRATION_URGENT = '#EF4444';
const EXPIRATION_SOON = '#F97316';
const EXPIRATION_APPROACHING = '#EAB308';
const EXPIRATION_STABLE = '#22C55E';
const EXPIRATION_LONG = '#3B82F6';

const LTL_AT_MARKET = '#3B82F6';
const LTL_LOW = '#22C55E';
const LTL_MODERATE = '#EAB308';
const LTL_HIGH = '#F97316';
const LTL_VERY_HIGH = '#EF4444';

const FLOOR_MIN = '#1E3A5F';
const FLOOR_MAX = '#38BDF8';
const MARKET_RENT_MIN = '#1E3A5F';
const MARKET_RENT_MAX = '#F59E0B';
const CONTRACT_RENT_MIN = '#1E3A5F';
const CONTRACT_RENT_MAX = '#8B5CF6';

// ─── Hex color helpers ──────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

export function lerpColorHex(c1: string, c2: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(
    r1 + (r2 - r1) * clamped,
    g1 + (g2 - g1) * clamped,
    b1 + (b2 - b1) * clamped,
  );
}

// ─── Filter color functions (return hex strings) ────────────────────────────

export function statusToColorHex(status: 'occupied' | 'vacant' | 'unknown'): string {
  switch (status) {
    case 'occupied': return OCCUPIED;
    case 'vacant': return VACANT;
    case 'unknown': return UNKNOWN;
  }
}

export function getExpirationColorHex(leaseEnd: string | null | undefined, refDate: Date): string {
  if (!leaseEnd) return NO_DATA;
  const end = new Date(leaseEnd);
  const diffDays = (end.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return EXPIRATION_URGENT;
  if (diffDays <= 90) return EXPIRATION_SOON;
  if (diffDays <= 180) return EXPIRATION_APPROACHING;
  if (diffDays <= 365) return EXPIRATION_STABLE;
  return EXPIRATION_LONG;
}

export function getLTLColorHex(
  marketRent: number | null | undefined,
  inPlaceRent: number | null | undefined,
): string {
  if (marketRent == null || inPlaceRent == null || marketRent <= 0 || inPlaceRent <= 0) return NO_DATA;
  const ltl = (marketRent - inPlaceRent) / marketRent;
  if (ltl <= 0) return LTL_AT_MARKET;
  if (ltl <= 0.05) return LTL_LOW;
  if (ltl <= 0.10) return LTL_MODERATE;
  if (ltl <= 0.20) return LTL_HIGH;
  return LTL_VERY_HIGH;
}

export function getRentGradientColorHex(
  value: number | null | undefined,
  min: number,
  max: number,
  colorMin: string,
  colorMax: string,
): string {
  if (value == null) return NO_DATA;
  const range = max - min;
  const t = range > 0 ? (value - min) / range : 0.5;
  return lerpColorHex(colorMin, colorMax, t);
}

// ─── Rent stats ─────────────────────────────────────────────────────────────

export interface RentStats {
  minMarketRent: number;
  maxMarketRent: number;
  minContractRent: number;
  maxContractRent: number;
  maxFloor: number;
}

export function computeRentStatsFromUnits(rentRollUnits: RentRollUnit[], maxFloor: number): RentStats {
  let minMarket = Infinity, maxMarket = -Infinity;
  let minContract = Infinity, maxContract = -Infinity;
  for (const u of rentRollUnits) {
    if (u.market_rent != null) {
      minMarket = Math.min(minMarket, u.market_rent);
      maxMarket = Math.max(maxMarket, u.market_rent);
    }
    if (u.in_place_rent != null) {
      minContract = Math.min(minContract, u.in_place_rent);
      maxContract = Math.max(maxContract, u.in_place_rent);
    }
  }
  return {
    minMarketRent: minMarket === Infinity ? 0 : minMarket,
    maxMarketRent: maxMarket === -Infinity ? 0 : maxMarket,
    minContractRent: minContract === Infinity ? 0 : minContract,
    maxContractRent: maxContract === -Infinity ? 0 : maxContract,
    maxFloor,
  };
}

// ─── Main dispatch: unit + filter → hex color ───────────────────────────────

export function getUnitColorHex(
  unit: RentRollUnit | undefined,
  floor: number,
  filter: StackingFilterType,
  refDate: Date,
  stats: RentStats,
): string {
  if (!unit) return UNKNOWN;

  switch (filter) {
    case 'occupancy': {
      const status = unit.is_occupied === true ? 'occupied'
        : unit.is_occupied === false ? 'vacant'
        : 'unknown';
      return statusToColorHex(status);
    }
    case 'floor_level':
      return lerpColorHex(FLOOR_MIN, FLOOR_MAX, (floor - 1) / Math.max(stats.maxFloor - 1, 1));
    case 'expirations':
      return getExpirationColorHex(unit.lease_end, refDate);
    case 'loss_to_lease':
      return getLTLColorHex(unit.market_rent, unit.in_place_rent);
    case 'market_rents':
      return getRentGradientColorHex(unit.market_rent, stats.minMarketRent, stats.maxMarketRent, MARKET_RENT_MIN, MARKET_RENT_MAX);
    case 'contract_rents':
      return getRentGradientColorHex(unit.in_place_rent, stats.minContractRent, stats.maxContractRent, CONTRACT_RENT_MIN, CONTRACT_RENT_MAX);
    default:
      return UNKNOWN;
  }
}
