/**
 * StackingViewer3D — Three.js procedural building renderer.
 * Generates 3D geometry from a StackingLayout, with interactive
 * raycasting for hover/click on individual units.
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { StackingLayout, StackingBuilding, RentRollUnit, StackingFilterType, UnitPositionMap } from '@/types/property';
import { Camera, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────
const UNIT_WIDTH = 4;
const UNIT_HEIGHT = 1.5;
const UNIT_DEPTH = 6;
const UNIT_GAP = 0.2;
const FLOOR_SLAB_HEIGHT = 0.1;
const BUILDING_GAP = 20;
const CORRIDOR_WIDTH = UNIT_DEPTH * 0.4; // hallway between the two unit rows (double-loaded)

// ─── Material palette — Lumen/Beans.AI inspired dark theme ───────────────────
const MATERIALS = {
  // Occupied unit: unified blue-grey facade
  occupied: new THREE.MeshPhysicalMaterial({
    color: 0x2d3561,
    metalness: 0.2,
    roughness: 0.5,
    transparent: true,
    opacity: 0.9,
    emissive: 0x1a1a3e,
    emissiveIntensity: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
  }),
  // Vacant unit: same facade base (status shown via stripe)
  vacant: new THREE.MeshPhysicalMaterial({
    color: 0x2d3561,
    metalness: 0.2,
    roughness: 0.5,
    transparent: true,
    opacity: 0.9,
    emissive: 0x1a1a3e,
    emissiveIntensity: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
  }),
  // No data: darker facade
  noData: new THREE.MeshPhysicalMaterial({
    color: 0x1a1a3e,
    metalness: 0.15,
    roughness: 0.6,
    transparent: true,
    opacity: 0.85,
    emissive: 0x0f0f2a,
    emissiveIntensity: 0.05,
  }),
  // Floor slab: dark concrete look with subtle faceted appearance
  slab: new THREE.MeshStandardMaterial({
    color: 0x1A1A2E,
    metalness: 0.35,
    roughness: 0.75,
    transparent: true,
    opacity: 0.65,
    flatShading: true,
  }),
  // Pool: translucent cyan water
  pool: new THREE.MeshPhysicalMaterial({
    color: 0x00d4ff,
    metalness: 0.0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.6,
    emissive: 0x006688,
    emissiveIntensity: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  }),
  // Parking: matte dark gray
  parking: new THREE.MeshStandardMaterial({
    color: 0x374151,
    metalness: 0.0,
    roughness: 0.9,
    transparent: true,
    opacity: 0.5,
  }),
  // Amenity default: warm accent
  amenity: new THREE.MeshStandardMaterial({
    color: 0xD97706,
    metalness: 0.1,
    roughness: 0.6,
    transparent: true,
    opacity: 0.5,
  }),
  // Ground plane
  ground: new THREE.MeshStandardMaterial({
    color: 0x0D0D1A,
    metalness: 0.0,
    roughness: 1.0,
    transparent: true,
    opacity: 0.3,
  }),
  // Window band: glass between floors
  windowBand: new THREE.MeshPhysicalMaterial({
    color: 0x88aacc,
    metalness: 0.3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
    emissive: 0x446688,
    emissiveIntensity: 0.1,
  }),
  // Window recess: dark glass inset on unit exterior faces
  windowRecess: new THREE.MeshPhysicalMaterial({
    color: 0x0a0a1e,
    metalness: 0.4,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
    emissive: new THREE.Color(0x111133),
    emissiveIntensity: 0.05,
  }),
};

// Edge line material for unit borders
const EDGE_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: 0x1E1B4B,
  transparent: true,
  opacity: 0.4,
});

// Shared window recess geometry (reused across all units for performance)
const WINDOW_RECESS_GEOM = new THREE.BoxGeometry(UNIT_WIDTH * 0.7, UNIT_HEIGHT * 0.5, 0.08);
const RECESS_DEPTH = 0.08;

function addWindowRecess(mesh: THREE.Mesh, wingDirection: string): void {
  const recess = new THREE.Mesh(WINDOW_RECESS_GEOM, MATERIALS.windowRecess);
  const halfDepth = UNIT_DEPTH / 2 - RECESS_DEPTH / 2 + 0.01;

  switch (wingDirection) {
    case 'south':
      recess.position.set(0, 0.1, halfDepth);
      break;
    case 'north':
      recess.position.set(0, 0.1, -halfDepth);
      break;
    case 'east':
      recess.position.set(halfDepth, 0.1, 0);
      recess.rotation.y = Math.PI / 2;
      break;
    case 'west':
      recess.position.set(-halfDepth, 0.1, 0);
      recess.rotation.y = Math.PI / 2;
      break;
  }

  recess.name = `window_${mesh.name}`;
  mesh.add(recess);
}

export interface UnitMeshData {
  building_id: string;
  building_label: string;
  floor: number;
  position: number;
  status: 'occupied' | 'vacant' | 'unknown';
  rentRollUnit?: RentRollUnit;
  wingDirection?: 'south' | 'north' | 'east' | 'west';
}

interface StackingViewer3DProps {
  layout: StackingLayout;
  rentRollUnits: RentRollUnit[];
  onUnitClick?: (data: UnitMeshData, event?: { ctrlKey?: boolean; metaKey?: boolean }) => void;
  selectedUnits?: UnitMeshData[];
  activeFilter?: StackingFilterType;
  asOfDate?: string | null;
  checkedFloorPlans?: Set<string>;
  explodedView?: boolean;
  isolatedFloor?: number | null;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  unitPositionMap?: UnitPositionMap | null;
}

// ─── Matching logic ──────────────────────────────────────────────────────────

/** Natural sort: treats numeric segments numerically ("9" < "10", "1A-002" sorts correctly). */
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Infer the floor number from a unit number string using common multifamily patterns.
 * Returns null if floor cannot be determined.
 *
 * Patterns handled:
 *   "0301" or "301" → floor 3  (first significant digit(s) before last 2 digits = floor)
 *   "A-301" or "1-205" → floor 3 or 2 (number after separator)
 */
function inferFloorFromUnitNumber(unitNumber: string, totalFloors: number): number | null {
  const num = unitNumber || '';

  // Strip building/wing prefix like "A-", "B1-", "Bldg2-"
  const cleaned = num.replace(/^[A-Za-z0-9]*[-_]/, '');
  const digits = cleaned.replace(/[^0-9]/g, '');

  if (!digits) return null;

  const numericValue = parseInt(digits, 10);

  // Pattern 1: 3-4 digit numbers where first significant digit(s) = floor
  // "301" → floor 3, "0301" → floor 3, "002" → floor 0
  if (digits.length >= 3 && digits.length <= 4) {
    const withoutLeadingZeros = digits.replace(/^0+/, '') || '0';
    if (withoutLeadingZeros.length >= 3) {
      const potentialFloor = parseInt(withoutLeadingZeros.slice(0, -2), 10);
      if (potentialFloor >= 0 && potentialFloor <= totalFloors) {
        return potentialFloor;
      }
    }
  }

  // Pattern 2: separator-based "1-205", "A-301"
  const separatorMatch = num.match(/[A-Za-z0-9]+[-_](\d{3,4})/);
  if (separatorMatch) {
    const afterSep = separatorMatch[1].replace(/^0+/, '') || '0';
    if (afterSep.length >= 3) {
      const potentialFloor = parseInt(afterSep.slice(0, -2), 10);
      if (potentialFloor >= 0 && potentialFloor <= totalFloors) {
        return potentialFloor;
      }
    }
  }

  // Pattern 3: Small numbers (< 100) with no floor pattern → floor 0 (ground)
  if (numericValue < 100 && totalFloors > 1) {
    return 0;
  }

  return null;
}

function matchUnitsToRentRoll(
  layout: StackingLayout,
  rentRollUnits: RentRollUnit[],
  unitPositionMap?: UnitPositionMap | null,
): Map<string, RentRollUnit> {
  const map = new Map<string, RentRollUnit>();
  if (!rentRollUnits.length) return map;

  // Deduplicate by id
  const seenIds = new Set<number>();
  const deduped = rentRollUnits.filter(u => {
    if (seenIds.has(u.id)) return false;
    seenIds.add(u.id);
    return true;
  });

  // ── Position-map matching: use position map for floor assignment, sequential placement within floor ──
  if (unitPositionMap && unitPositionMap.floors.length > 0) {
    // Build floor assignment from position map: unit_number → geometry floor
    const unitFloorMap = new Map<string, number>();
    for (const floorData of unitPositionMap.floors) {
      // Floor in the position map is 0-indexed; geometry uses 1-indexed
      const geometryFloor = floorData.floor + 1;
      for (const wing of floorData.wings) {
        for (const unitNum of wing.unit_numbers) {
          unitFloorMap.set(unitNum, geometryFloor);
        }
      }
    }

    // Build a lookup from unit_number → RentRollUnit
    const unitByNumber = new Map<string, RentRollUnit>();
    for (const u of deduped) {
      if (u.unit_number) unitByNumber.set(u.unit_number, u);
    }

    // Use the first building (floor plan extraction generates a single building)
    const bldgId = layout.buildings[0]?.id || 'A';
    const maxFloor = Math.max(...unitFloorMap.values(), layout.buildings[0]?.num_floors || 5);

    // Group units by their position-map floor and assign sequentially within each floor
    for (let floor = 1; floor <= maxFloor; floor++) {
      const floorUnits: RentRollUnit[] = [];
      for (const [unitNum, f] of unitFloorMap) {
        if (f === floor) {
          const rr = unitByNumber.get(unitNum);
          if (rr) floorUnits.push(rr);
        }
      }
      // Sort within floor for consistent ordering
      floorUnits.sort((a, b) => naturalSort(a.unit_number || '', b.unit_number || ''));

      // Assign sequentially within the floor's mesh positions
      for (let pos = 0; pos < floorUnits.length; pos++) {
        const key = `${bldgId}_${floor}_${pos + 1}`;
        map.set(key, floorUnits[pos]);
      }
    }

    // Handle units not in the position map — distribute to floors with remaining slots
    const mappedUnitNumbers = new Set(unitFloorMap.keys());
    const unmapped = deduped.filter(u => u.unit_number && !mappedUnitNumbers.has(u.unit_number));
    const totalFloors = maxFloor;
    for (const u of unmapped) {
      const floor = inferFloorFromUnitNumber(u.unit_number || '', totalFloors) || 1;
      // Find next available position on this floor
      let pos = 1;
      while (map.has(`${bldgId}_${floor}_${pos}`)) pos++;
      map.set(`${bldgId}_${floor}_${pos}`, u);
    }

    return map;
  }

  // ── Heuristic matching (existing behavior) ──
  const totalFloors = layout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);

  // Try to infer floor from unit number
  const unitsWithFloor = deduped.map(u => ({
    unit: u,
    inferredFloor: inferFloorFromUnitNumber(u.unit_number || '', totalFloors),
  }));

  const inferredCount = unitsWithFloor.filter(u => u.inferredFloor !== null).length;

  // Detect ground floor (0xx) units and shift all floors up so geometry stays 1-based
  const minFloor = unitsWithFloor.reduce(
    (m, u) => u.inferredFloor !== null ? Math.min(m, u.inferredFloor) : m, Infinity
  );
  const floorOffset = minFloor === 0 ? 1 : 0;
  if (floorOffset) {
    for (const u of unitsWithFloor) {
      if (u.inferredFloor !== null) u.inferredFloor += floorOffset;
    }
  }

  const useInferredFloors = inferredCount > deduped.length * 0.5;

  if (useInferredFloors) {
    // Floor-aware grouping
    const maxInferred = unitsWithFloor.reduce((m, u) => Math.max(m, u.inferredFloor || 0), 0);
    for (const bldg of layout.buildings) {
      const effectiveFloors = Math.max(bldg.num_floors, maxInferred);
      for (let floor = 1; floor <= effectiveFloors; floor++) {
        const floorUnits = unitsWithFloor
          .filter(u => u.inferredFloor === floor)
          .sort((a, b) => naturalSort(a.unit.unit_number || '', b.unit.unit_number || ''));

        for (let pos = 0; pos < Math.min(floorUnits.length, bldg.units_per_floor); pos++) {
          const key = `${bldg.id}_${floor}_${pos + 1}`;
          map.set(key, floorUnits[pos].unit);
        }
      }

      // Distribute unmatched units to floors with remaining slots
      const unmatchedUnits = unitsWithFloor
        .filter(u => u.inferredFloor === null || u.inferredFloor > effectiveFloors)
        .sort((a, b) => naturalSort(a.unit.unit_number || '', b.unit.unit_number || ''));

      let unmatchedIdx = 0;
      for (let floor = 1; floor <= bldg.num_floors && unmatchedIdx < unmatchedUnits.length; floor++) {
        const assignedOnFloor = Array.from(map.keys()).filter(k => k.startsWith(`${bldg.id}_${floor}_`)).length;
        for (let pos = assignedOnFloor + 1; pos <= bldg.units_per_floor && unmatchedIdx < unmatchedUnits.length; pos++) {
          const key = `${bldg.id}_${floor}_${pos}`;
          if (!map.has(key)) {
            map.set(key, unmatchedUnits[unmatchedIdx].unit);
            unmatchedIdx++;
          }
        }
      }
    }
  } else {
    // Fallback: sequential assignment (current behavior) with dedup
    const modelKeys: string[] = [];
    for (const bldg of layout.buildings) {
      for (let floor = 1; floor <= bldg.num_floors; floor++) {
        for (let pos = 1; pos <= bldg.units_per_floor; pos++) {
          modelKeys.push(`${bldg.id}_${floor}_${pos}`);
        }
      }
    }

    const sorted = [...deduped].sort((a, b) =>
      naturalSort(a.unit_number || '', b.unit_number || ''),
    );

    for (let i = 0; i < Math.min(sorted.length, modelKeys.length); i++) {
      map.set(modelKeys[i], sorted[i]);
    }
  }

  return map;
}

/**
 * Adjust building num_floors and units_per_floor based on inferred floor counts
 * from rent roll unit numbers. When units have 0xx numbers (ground floor), the
 * floor offset shifts everything up by 1, potentially creating more floors than
 * the layout specifies. This ensures geometry matches the matching logic.
 */
function adjustLayoutForInferredFloors(
  layout: StackingLayout,
  rentRollUnits: RentRollUnit[],
): StackingLayout {
  if (!rentRollUnits.length) return layout;

  const totalFloors = layout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);

  // Infer floors for all units
  const inferred = rentRollUnits.map(u =>
    inferFloorFromUnitNumber(u.unit_number || '', totalFloors + 1),
  );

  const validFloors = inferred.filter((f): f is number => f !== null);
  if (validFloors.length < rentRollUnits.length * 0.5) return layout;

  const minFloor = Math.min(...validFloors);
  const offset = minFloor === 0 ? 1 : 0;
  const maxFloorAfterOffset = Math.max(...validFloors) + offset;

  // Count units per floor after offset
  const floorCounts = new Map<number, number>();
  for (const f of validFloors) {
    const adjusted = f + offset;
    floorCounts.set(adjusted, (floorCounts.get(adjusted) || 0) + 1);
  }
  const maxUnitsOnAnyFloor = Math.max(...floorCounts.values(), 0);

  // Check if any building needs adjustment
  const needsAdjustment = layout.buildings.some(
    b => maxFloorAfterOffset > b.num_floors || maxUnitsOnAnyFloor > b.units_per_floor,
  );
  if (!needsAdjustment) return layout;

  return {
    ...layout,
    buildings: layout.buildings.map(bldg => ({
      ...bldg,
      num_floors: Math.max(bldg.num_floors, maxFloorAfterOffset),
      units_per_floor: Math.max(bldg.units_per_floor, maxUnitsOnAnyFloor),
    })),
  };
}

// ─── Geometry builders ───────────────────────────────────────────────────────

function getUnitStatus(rentRollUnit?: RentRollUnit): 'occupied' | 'vacant' | 'unknown' {
  if (!rentRollUnit) return 'unknown';
  if (rentRollUnit.is_occupied === true) return 'occupied';
  if (rentRollUnit.is_occupied === false) return 'vacant';
  // Infer from status string
  const s = (rentRollUnit.status || '').toLowerCase();
  if (s.includes('vacant')) return 'vacant';
  if (s.includes('occupied') || s.includes('current')) return 'occupied';
  return 'unknown';
}

function getMaterialForStatus(status: 'occupied' | 'vacant' | 'unknown'): THREE.MeshPhysicalMaterial {
  switch (status) {
    case 'occupied': return MATERIALS.occupied.clone();
    case 'vacant': return MATERIALS.vacant.clone();
    case 'unknown': return MATERIALS.noData.clone();
  }
}

/** Attach edge wireframe + shadow flags to a unit mesh */
function addUnitEdges(mesh: THREE.Mesh, geom: THREE.BufferGeometry) {
  const edges = new THREE.EdgesGeometry(geom);
  const wireframe = new THREE.LineSegments(edges, EDGE_LINE_MATERIAL.clone());
  mesh.add(wireframe);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/** Add a thin colored status stripe on the exterior front face of a unit */
function addStatusStripe(mesh: THREE.Mesh, status: 'occupied' | 'vacant' | 'unknown', wingDirection: WingDirection = 'south') {
  mesh.geometry.computeBoundingBox();
  const sz = new THREE.Vector3();
  mesh.geometry.boundingBox!.getSize(sz);

  const stripeColor = statusToColor(status);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: stripeColor,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  // Stripe: full face width × 15% of face height, at bottom of exterior face
  const faceWidth = (wingDirection === 'east' || wingDirection === 'west') ? sz.z : sz.x;
  const stripeGeom = new THREE.PlaneGeometry(faceWidth * 0.95, sz.y * 0.15);
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);

  const offset = 0.01;
  switch (wingDirection) {
    case 'south':
      stripe.position.set(0, -sz.y * 0.35, sz.z / 2 + offset);
      break;
    case 'north':
      stripe.position.set(0, -sz.y * 0.35, -(sz.z / 2 + offset));
      stripe.rotation.y = Math.PI;
      break;
    case 'east':
      stripe.position.set(sz.x / 2 + offset, -sz.y * 0.35, 0);
      stripe.rotation.y = Math.PI / 2;
      break;
    case 'west':
      stripe.position.set(-(sz.x / 2 + offset), -sz.y * 0.35, 0);
      stripe.rotation.y = -Math.PI / 2;
      break;
  }
  stripe.name = `stripe_${mesh.name}`;
  mesh.add(stripe);
}

/** Add a glass window band strip between floors */
function addWindowBand(group: THREE.Group, width: number, depth: number, floorY: number, x: number = 0, z: number = 0) {
  const bandHeight = UNIT_HEIGHT * 0.12;
  const geom = new THREE.BoxGeometry(width + 0.1, bandHeight, depth + 0.1);
  const mesh = new THREE.Mesh(geom, MATERIALS.windowBand.clone());
  mesh.position.set(x, floorY - FLOOR_SLAB_HEIGHT / 2 - bandHeight / 2 - 0.01, z);
  mesh.name = 'window_band';
  group.add(mesh);
}

// ─── Unit number label textures ─────────────────────────────────────────────

type WingDirection = 'south' | 'north' | 'east' | 'west';

function createUnitNumberTexture(unitNumber: string, fontSize: number = 28): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 64);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = `bold ${Math.round(fontSize)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillText(unitNumber, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function addUnitLabel(
  mesh: THREE.Mesh,
  rr: RentRollUnit | undefined,
  wingDirection: WingDirection = 'south',
  totalUnits: number = 100,
) {
  const unitNumber = rr?.unit_number;
  if (!unitNumber) return;

  // Read actual geometry dimensions (handles rotated boxes like UNIT_DEPTH x H x UNIT_WIDTH)
  mesh.geometry.computeBoundingBox();
  const sz = new THREE.Vector3();
  mesh.geometry.boundingBox!.getSize(sz);

  // Scale font size inversely with total unit count for legibility
  const fontSize = Math.max(18, Math.min(48, 2400 / totalUnits));
  const labelTexture = createUnitNumberTexture(unitNumber, fontSize);

  // Label width should span the "wide" face of the unit
  const labelWidth = (wingDirection === 'east' || wingDirection === 'west') ? sz.z * 0.85 : sz.x * 0.85;
  const labelHeight = sz.y * 0.7;

  // Build configs for two label planes: exterior face + interior (opposite) face
  const configs: Array<{ position: THREE.Vector3; rotation: THREE.Euler }> = [];
  const offset = 0.01;
  switch (wingDirection) {
    case 'south':
      configs.push(
        { position: new THREE.Vector3(0, 0, sz.z / 2 + offset), rotation: new THREE.Euler(0, 0, 0) },
        { position: new THREE.Vector3(0, 0, -(sz.z / 2 + offset)), rotation: new THREE.Euler(0, Math.PI, 0) },
      );
      break;
    case 'north':
      configs.push(
        { position: new THREE.Vector3(0, 0, -(sz.z / 2 + offset)), rotation: new THREE.Euler(0, Math.PI, 0) },
        { position: new THREE.Vector3(0, 0, sz.z / 2 + offset), rotation: new THREE.Euler(0, 0, 0) },
      );
      break;
    case 'east':
      configs.push(
        { position: new THREE.Vector3(sz.x / 2 + offset, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) },
        { position: new THREE.Vector3(-(sz.x / 2 + offset), 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) },
      );
      break;
    case 'west':
      configs.push(
        { position: new THREE.Vector3(-(sz.x / 2 + offset), 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) },
        { position: new THREE.Vector3(sz.x / 2 + offset, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) },
      );
      break;
  }

  for (const cfg of configs) {
    const labelMat = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      depthTest: true,
      side: THREE.FrontSide,
    });
    const labelGeom = new THREE.PlaneGeometry(labelWidth, labelHeight);
    const labelMesh = new THREE.Mesh(labelGeom, labelMat);
    labelMesh.position.copy(cfg.position);
    labelMesh.rotation.copy(cfg.rotation);
    labelMesh.name = `label_${mesh.name}`;
    mesh.add(labelMesh);
  }
}

// ─── Filter color helpers ───────────────────────────────────────────────────

function lerpColor(c1: number, c2: number, t: number): THREE.Color {
  const color1 = new THREE.Color(c1);
  const color2 = new THREE.Color(c2);
  return color1.lerp(color2, Math.max(0, Math.min(1, t)));
}

function statusToColor(status: 'occupied' | 'vacant' | 'unknown'): THREE.Color {
  switch (status) {
    case 'occupied': return new THREE.Color(0x7C3AED);
    case 'vacant': return new THREE.Color(0xF43F5E);
    case 'unknown': return new THREE.Color(0x3F3F5A);
  }
}

function getExpirationColor(leaseEnd: string | null | undefined, refDate: Date): THREE.Color {
  if (!leaseEnd) return new THREE.Color(0x6B7280);
  const end = new Date(leaseEnd);
  const diffMs = end.getTime() - refDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return new THREE.Color(0xEF4444);   // expired or urgent
  if (diffDays <= 90) return new THREE.Color(0xF97316);   // soon
  if (diffDays <= 180) return new THREE.Color(0xEAB308);  // approaching
  if (diffDays <= 365) return new THREE.Color(0x22C55E);  // stable
  return new THREE.Color(0x3B82F6);                        // long-term
}

function formatLTL(
  marketRent: number | null | undefined,
  inPlaceRent: number | null | undefined,
): string {
  if (!marketRent || marketRent <= 0) return '—';
  if (inPlaceRent == null || inPlaceRent <= 0) return '—';
  const ltl = ((marketRent - inPlaceRent) / marketRent) * 100;
  if (ltl < 0) return '0.0%';
  return `${ltl.toFixed(1)}%`;
}

function getLTLColor(marketRent: number | null | undefined, inPlaceRent: number | null | undefined): THREE.Color {
  if (marketRent == null || inPlaceRent == null || marketRent <= 0 || inPlaceRent <= 0) return new THREE.Color(0x6B7280);
  const ltl = (marketRent - inPlaceRent) / marketRent;
  if (ltl <= 0) return new THREE.Color(0x3B82F6);      // at or above market
  if (ltl <= 0.05) return new THREE.Color(0x22C55E);    // 1-5%
  if (ltl <= 0.10) return new THREE.Color(0xEAB308);    // 5-10%
  if (ltl <= 0.20) return new THREE.Color(0xF97316);    // 10-20%
  return new THREE.Color(0xEF4444);                      // 20%+
}

function getRentGradientColor(
  value: number | null | undefined,
  min: number,
  max: number,
  colorMin: number,
  colorMax: number,
): THREE.Color {
  if (value == null) return new THREE.Color(0x6B7280);
  const range = max - min;
  const t = range > 0 ? (value - min) / range : 0.5;
  return lerpColor(colorMin, colorMax, t);
}

interface RentStats {
  minMarketRent: number;
  maxMarketRent: number;
  minContractRent: number;
  maxContractRent: number;
  maxFloor: number;
}

function computeRentStats(rentRollUnits: RentRollUnit[], layout: StackingLayout): RentStats {
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
  const maxFloor = layout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);
  return {
    minMarketRent: minMarket === Infinity ? 0 : minMarket,
    maxMarketRent: maxMarket === -Infinity ? 0 : maxMarket,
    minContractRent: minContract === Infinity ? 0 : minContract,
    maxContractRent: maxContract === -Infinity ? 0 : maxContract,
    maxFloor,
  };
}

function applyFilterToScene(
  scene: THREE.Scene,
  filterType: StackingFilterType,
  stats: RentStats,
  refDate: Date,
) {
  scene.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh) || !obj.name.startsWith('unit_')) return;
    const ud = obj.userData as UnitMeshData;

    let color: THREE.Color;
    switch (filterType) {
      case 'occupancy':
        color = statusToColor(ud.status);
        break;
      case 'floor_level':
        color = lerpColor(0x1E3A5F, 0x38BDF8, (ud.floor - 1) / Math.max(stats.maxFloor - 1, 1));
        break;
      case 'expirations':
        color = getExpirationColor(ud.rentRollUnit?.lease_end, refDate);
        break;
      case 'loss_to_lease':
        color = getLTLColor(ud.rentRollUnit?.market_rent, ud.rentRollUnit?.in_place_rent);
        break;
      case 'market_rents':
        color = getRentGradientColor(ud.rentRollUnit?.market_rent, stats.minMarketRent, stats.maxMarketRent, 0x1E3A5F, 0xF59E0B);
        break;
      case 'contract_rents':
        color = getRentGradientColor(ud.rentRollUnit?.in_place_rent, stats.minContractRent, stats.maxContractRent, 0x1E3A5F, 0x8B5CF6);
        break;
      default:
        color = statusToColor(ud.status);
    }

    // Apply filter color to unit body material
    const unitMat = obj.material as THREE.MeshPhysicalMaterial;
    unitMat.emissive.copy(color);
    unitMat.emissiveIntensity = 0.35;
    unitMat.color.lerp(color, 0.4);
    // Ensure unit is visible (fix for build-up animation snapshot interaction)
    if (unitMat.opacity < 0.5) {
      unitMat.opacity = ud.status === 'unknown' ? 0.85 : 0.9;
    }
    unitMat.needsUpdate = true;

    // Update status stripe color (child mesh named stripe_unit_*)
    obj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.name.startsWith('stripe_')) {
        const stripeMat = child.material as THREE.MeshBasicMaterial;
        stripeMat.color.copy(color);
        stripeMat.needsUpdate = true;
      }
    });
  });
}

interface MaterialSnapshot {
  color: THREE.Color;
  opacity: number;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

function restoreFromSnapshot(
  scene: THREE.Scene,
  snapshot: Map<string, MaterialSnapshot>,
) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const snap = snapshot.get(obj.uuid);
    if (!snap) return;
    const mat = obj.material as THREE.MeshStandardMaterial;
    mat.color.copy(snap.color);
    mat.opacity = snap.opacity;
    if ('emissive' in mat) (mat as THREE.MeshStandardMaterial).emissive.copy(snap.emissive);
    if ('emissiveIntensity' in mat) (mat as THREE.MeshPhysicalMaterial).emissiveIntensity = snap.emissiveIntensity;
    mat.needsUpdate = true;
  });
}

// ─── Geometry builders ──────────────────────────────────────────────────────

function buildLinearBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
  totalUnits: number = 100,
) {
  const unitsPerFloor = building.units_per_floor;
  // Double-loaded: split each floor into exterior Row A and interior Row B
  const rowACount = Math.ceil(unitsPerFloor / 2);
  const rowBCount = Math.floor(unitsPerFloor / 2);
  const rowAWidth = rowACount * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  const rowBWidth = rowBCount > 0 ? rowBCount * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP : 0;
  const totalWidth = rowAWidth; // slab sized to the larger (exterior) row

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    const wingDepth = UNIT_DEPTH * 2 + CORRIDOR_WIDTH;

    // Floor slab spans full double-loaded depth, centered between the two rows
    const slabGeom = new THREE.BoxGeometry(totalWidth + 0.3, FLOOR_SLAB_HEIGHT, wingDepth + 0.3);
    const slab = new THREE.Mesh(slabGeom, MATERIALS.slab.clone());
    slab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
    group.add(slab);

    // Window band between floors
    if (floor > 1) {
      addWindowBand(group, totalWidth, wingDepth, floorY, 0, (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
    }

    // Row A — exterior, z = 0 (same as current single-row behavior)
    for (let i = 0; i < rowACount; i++) {
      const pos = i + 1;
      const key = `${building.id}_${floor}_${pos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);

      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);

      const x = i * (UNIT_WIDTH + UNIT_GAP) - rowAWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, 0);
      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = {
        building_id: building.id,
        building_label: building.label,
        floor,
        position: pos,
        status,
        rentRollUnit: rr,
        wingDirection: 'south',
      } satisfies UnitMeshData;

      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'south', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
    }

    // Row B — interior (corridor-facing), z = UNIT_DEPTH + CORRIDOR_WIDTH
    for (let i = 0; i < rowBCount; i++) {
      const pos = rowACount + i + 1;
      const key = `${building.id}_${floor}_${pos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);

      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);

      const x = i * (UNIT_WIDTH + UNIT_GAP) - rowBWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, UNIT_DEPTH + CORRIDOR_WIDTH);
      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = {
        building_id: building.id,
        building_label: building.label,
        floor,
        position: pos,
        status,
        rentRollUnit: rr,
        wingDirection: 'north',
      } satisfies UnitMeshData;

      addUnitEdges(mesh, geom);
      // Interior face (toward corridor) = -Z face = 'north' primary label
      addUnitLabel(mesh, rr, 'north', totalUnits);
      // Exterior face (outward) = +Z face = 'south' stripe
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
    }
  }

}

function buildLShapeBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
  totalUnits: number = 100,
) {
  const halfUnits = building.wings?.[0]?.units_per_floor ?? Math.ceil(building.units_per_floor / 2);
  const otherHalf = building.wings?.[1]?.units_per_floor ?? (building.units_per_floor - halfUnits);

  // Wing 1 (along X): double-loaded in Z
  const w1RowA = Math.ceil(halfUnits / 2);
  const w1RowB = Math.floor(halfUnits / 2);
  const wing1Width = w1RowA * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  // Wing 2 (along -Z): double-loaded in X
  const w2RowA = Math.ceil(otherHalf / 2);
  const w2RowB = Math.floor(otherHalf / 2);
  const wing2Depth = w2RowA * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  const wingDepth = UNIT_DEPTH * 2 + CORRIDOR_WIDTH;

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    let floorPos = 0;

    // Slab for wing 1 (spans full double-loaded depth in Z)
    const slab1Geom = new THREE.BoxGeometry(wing1Width + 0.3, FLOOR_SLAB_HEIGHT, wingDepth + 0.3);
    const slab1 = new THREE.Mesh(slab1Geom, MATERIALS.slab.clone());
    slab1.position.set(wing1Width / 2, floorY - FLOOR_SLAB_HEIGHT / 2, (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
    group.add(slab1);

    // Slab for wing 2 (spans full double-loaded depth in X, on the -X side)
    const slab2Geom = new THREE.BoxGeometry(wingDepth + 0.3, FLOOR_SLAB_HEIGHT, wing2Depth + 0.3);
    const slab2 = new THREE.Mesh(slab2Geom, MATERIALS.slab.clone());
    slab2.position.set(-(UNIT_DEPTH + CORRIDOR_WIDTH) / 2, floorY - FLOOR_SLAB_HEIGHT / 2, -(wing2Depth / 2 + UNIT_DEPTH / 2 + UNIT_GAP));
    group.add(slab2);

    // Window bands between floors
    if (floor > 1) {
      addWindowBand(group, wing1Width, wingDepth, floorY, wing1Width / 2, (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
      addWindowBand(group, wingDepth, wing2Depth, floorY, -(UNIT_DEPTH + CORRIDOR_WIDTH) / 2, -(wing2Depth / 2 + UNIT_DEPTH / 2 + UNIT_GAP));
    }

    // Wing 1 Row A (along X, z = 0, exterior)
    for (let i = 0; i < w1RowA; i++) {
      floorPos++;
      const key = `${building.id}_${floor}_${floorPos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      mesh.position.set(i * (UNIT_WIDTH + UNIT_GAP), floorY + UNIT_HEIGHT / 2, 0);
      mesh.name = `unit_${building.id}_${floor}_${floorPos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: floorPos, status, rentRollUnit: rr, wingDirection: 'south' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'south', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
    }

    // Wing 1 Row B (along X, z = UNIT_DEPTH + CORRIDOR_WIDTH, interior)
    for (let i = 0; i < w1RowB; i++) {
      floorPos++;
      const key = `${building.id}_${floor}_${floorPos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      mesh.position.set(i * (UNIT_WIDTH + UNIT_GAP), floorY + UNIT_HEIGHT / 2, UNIT_DEPTH + CORRIDOR_WIDTH);
      mesh.name = `unit_${building.id}_${floor}_${floorPos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: floorPos, status, rentRollUnit: rr, wingDirection: 'north' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'north', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
    }

    // Wing 2 Row A (along -Z, x = 0, exterior)
    for (let i = 0; i < w2RowA; i++) {
      floorPos++;
      const key = `${building.id}_${floor}_${floorPos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
      mesh.position.set(0, floorY + UNIT_HEIGHT / 2, z);
      mesh.name = `unit_${building.id}_${floor}_${floorPos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: floorPos, status, rentRollUnit: rr, wingDirection: 'west' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'west', totalUnits);
      addStatusStripe(mesh, status, 'west');
      group.add(mesh);
    }

    // Wing 2 Row B (along -Z, x = -(UNIT_DEPTH + CORRIDOR_WIDTH), interior)
    for (let i = 0; i < w2RowB; i++) {
      floorPos++;
      const key = `${building.id}_${floor}_${floorPos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
      mesh.position.set(-(UNIT_DEPTH + CORRIDOR_WIDTH), floorY + UNIT_HEIGHT / 2, z);
      mesh.name = `unit_${building.id}_${floor}_${floorPos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: floorPos, status, rentRollUnit: rr, wingDirection: 'east' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'east', totalUnits);
      addStatusStripe(mesh, status, 'west');
      group.add(mesh);
    }
  }

}

function buildUShapeBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
  totalUnits: number = 100,
) {
  // Split units across 3 wings — use wing data if available
  const wings = building.wings && building.wings.length >= 3
    ? [building.wings[0].units_per_floor, building.wings[1].units_per_floor, building.wings[2].units_per_floor]
    : (() => {
        const wingUnits = Math.floor(building.units_per_floor / 3);
        const remainder = building.units_per_floor - wingUnits * 3;
        return [wingUnits + (remainder > 0 ? 1 : 0), wingUnits + (remainder > 1 ? 1 : 0), wingUnits];
      })();

  const wingWidth = (w: number) => w * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  const maxWingWidth = wingWidth(Math.max(...wings));
  const wingDepth = UNIT_DEPTH * 2 + CORRIDOR_WIDTH;

  // Double-loaded row splits per wing
  const leftRowA = Math.ceil(wings[0] / 2);
  const leftRowB = Math.floor(wings[0] / 2);
  const bottomRowA = Math.ceil(wings[1] / 2);
  const bottomRowB = Math.floor(wings[1] / 2);
  const rightRowA = Math.ceil(wings[2] / 2);
  const rightRowB = Math.floor(wings[2] / 2);

  // Positions for left/right wing anchors (inner edge fixed, expand outward)
  const leftX = -(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP);    // Row A center X
  const rightX = maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP;      // Row A center X

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    let posCounter = 1;

    // ── Left wing Row A (along -Z, x = leftX, exterior) ──
    for (let i = 0; i < leftRowA; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      mesh.position.set(leftX, floorY + UNIT_HEIGHT / 2, -i * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'west' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'west', totalUnits);
      addStatusStripe(mesh, status, 'west');
      group.add(mesh);
      posCounter++;
    }

    // ── Left wing Row B (along -Z, x = leftX - (UNIT_DEPTH + CORRIDOR_WIDTH), interior) ──
    for (let i = 0; i < leftRowB; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      mesh.position.set(leftX - (UNIT_DEPTH + CORRIDOR_WIDTH), floorY + UNIT_HEIGHT / 2, -i * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'east' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'east', totalUnits);
      addStatusStripe(mesh, status, 'west');
      group.add(mesh);
      posCounter++;
    }

    // ── Bottom wing Row A (along X, z = bottomZ, exterior) ──
    const bottomZ = -(wings[0] - 1) * (UNIT_WIDTH + UNIT_GAP) - UNIT_WIDTH / 2 - UNIT_GAP;
    for (let i = 0; i < bottomRowA; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      const x = i * (UNIT_WIDTH + UNIT_GAP) - maxWingWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, bottomZ);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'south' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'south', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
      posCounter++;
    }

    // ── Bottom wing Row B (along X, z = bottomZ + UNIT_DEPTH + CORRIDOR_WIDTH, interior) ──
    const bottomRowBWidth = bottomRowB > 0 ? bottomRowB * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP : 0;
    for (let i = 0; i < bottomRowB; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      const x = i * (UNIT_WIDTH + UNIT_GAP) - bottomRowBWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, bottomZ + UNIT_DEPTH + CORRIDOR_WIDTH);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'north' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'north', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
      posCounter++;
    }

    // ── Right wing Row A (along -Z from top, x = rightX, exterior) ──
    for (let i = 0; i < rightRowA; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      mesh.position.set(rightX, floorY + UNIT_HEIGHT / 2, -(wings[0] - 1 - i) * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'east' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'east', totalUnits);
      addStatusStripe(mesh, status, 'east');
      group.add(mesh);
      posCounter++;
    }

    // ── Right wing Row B (along -Z from top, x = rightX + UNIT_DEPTH + CORRIDOR_WIDTH, interior) ──
    for (let i = 0; i < rightRowB; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      mesh.position.set(rightX + UNIT_DEPTH + CORRIDOR_WIDTH, floorY + UNIT_HEIGHT / 2, -(wings[0] - 1 - i) * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'west' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'west', totalUnits);
      addStatusStripe(mesh, status, 'east');
      group.add(mesh);
      posCounter++;
    }

    // Floor slabs (double-loaded depth for each wing)
    const slab1 = new THREE.Mesh(new THREE.BoxGeometry(wingDepth + 0.3, FLOOR_SLAB_HEIGHT, wingWidth(wings[0]) + 0.3), MATERIALS.slab.clone());
    slab1.position.set(leftX - (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, floorY - FLOOR_SLAB_HEIGHT / 2, -(wings[0] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    group.add(slab1);

    const slab2 = new THREE.Mesh(new THREE.BoxGeometry(maxWingWidth + 0.3, FLOOR_SLAB_HEIGHT, wingDepth + 0.3), MATERIALS.slab.clone());
    slab2.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, bottomZ + (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
    group.add(slab2);

    const slab3 = new THREE.Mesh(new THREE.BoxGeometry(wingDepth + 0.3, FLOOR_SLAB_HEIGHT, wingWidth(wings[2]) + 0.3), MATERIALS.slab.clone());
    slab3.position.set(rightX + (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, floorY - FLOOR_SLAB_HEIGHT / 2, -(wings[2] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    group.add(slab3);

    // Window bands between floors
    if (floor > 1) {
      addWindowBand(group, wingDepth, wingWidth(wings[0]), floorY, leftX - (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, -(wings[0] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
      addWindowBand(group, maxWingWidth, wingDepth, floorY, 0, bottomZ + (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
      addWindowBand(group, wingDepth, wingWidth(wings[2]), floorY, rightX + (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, -(wings[2] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    }
  }

}

function buildTowerBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
  totalUnits: number = 100,
) {
  // Tower: units arranged in a grid on each floor
  const cols = Math.ceil(Math.sqrt(building.units_per_floor));
  const rows = Math.ceil(building.units_per_floor / cols);
  const gridWidth = cols * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  const gridDepth = rows * (UNIT_DEPTH + UNIT_GAP) - UNIT_GAP;

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);

    // Slab
    const slabGeom = new THREE.BoxGeometry(gridWidth + 0.3, FLOOR_SLAB_HEIGHT, gridDepth + 0.3);
    const slab = new THREE.Mesh(slabGeom, MATERIALS.slab.clone());
    slab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slab);

    // Window band between floors
    if (floor > 1) {
      addWindowBand(group, gridWidth, gridDepth, floorY, 0, 0);
    }

    let posCounter = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (posCounter > building.units_per_floor) break;
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);

        const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
        const mat = getMaterialForStatus(status);
        const mesh = new THREE.Mesh(geom, mat);

        const x = c * (UNIT_WIDTH + UNIT_GAP) - gridWidth / 2 + UNIT_WIDTH / 2;
        const z = r * (UNIT_DEPTH + UNIT_GAP) - gridDepth / 2 + UNIT_DEPTH / 2;
        mesh.position.set(x, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'south' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'south', totalUnits);
        addStatusStripe(mesh, status, 'south');
        group.add(mesh);
        posCounter++;
      }
    }
  }

}

function buildCourtyardBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
  totalUnits: number = 100,
) {
  // Distribute units across 4 wings (N, E, S, W) — use wing data if available
  const wingCounts: number[] = building.wings && building.wings.length >= 3
    ? building.wings.map((w) => w.units_per_floor)
    : (() => {
        const numWings = 4;
        const base = Math.floor(building.units_per_floor / numWings);
        const remainder = building.units_per_floor - base * numWings;
        return Array.from({ length: numWings }, (_, i) => base + (i < remainder ? 1 : 0));
      })();

  const numWings = wingCounts.length;

  // Apply rectangular aspect ratio when all 4 wings have equal unit counts
  if (numWings >= 4 && wingCounts.every((c) => c === wingCounts[0])) {
    const totalPerFloor = building.units_per_floor;
    const longSide = Math.round(totalPerFloor * 0.35);
    const shortSide = Math.round(totalPerFloor * 0.15);
    wingCounts[0] = longSide;   // north
    wingCounts[1] = shortSide;  // east
    wingCounts[2] = longSide;   // south
    wingCounts[3] = totalPerFloor - longSide - shortSide - longSide;
  }

  const horizWidth = (units: number) => units * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  const vertDepth = (units: number) => units * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  const northWidth = horizWidth(wingCounts[0]);
  const eastDepth = numWings >= 2 ? vertDepth(wingCounts[1]) : 0;
  const southWidth = numWings >= 3 ? horizWidth(wingCounts[2]) : 0;
  const westDepth = numWings >= 4 ? vertDepth(wingCounts[3]) : eastDepth;

  const courtyardWidth = Math.max(northWidth, southWidth);
  const courtyardDepth = Math.max(eastDepth, westDepth);

  // Inner courtyard edges (fixed — wings expand OUTWARD from here)
  // North wing: inner edge at z = -UNIT_DEPTH/2 (Row A center stays at z=0)
  // East wing: inner edge at x = eastX - UNIT_DEPTH/2 (Row A center stays at eastX)
  const eastX = courtyardWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP;
  const westX = -(courtyardWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP);
  const southZ = -(courtyardDepth + UNIT_DEPTH + UNIT_GAP * 2);

  const wingDepth = UNIT_DEPTH * 2 + CORRIDOR_WIDTH;

  // Double-loaded row splits per wing
  const nRowA = Math.ceil(wingCounts[0] / 2);
  const nRowB = Math.floor(wingCounts[0] / 2);
  const eRowA = numWings >= 2 ? Math.ceil(wingCounts[1] / 2) : 0;
  const eRowB = numWings >= 2 ? Math.floor(wingCounts[1] / 2) : 0;
  const sRowA = numWings >= 3 ? Math.ceil(wingCounts[2] / 2) : 0;
  const sRowB = numWings >= 3 ? Math.floor(wingCounts[2] / 2) : 0;
  const wRowA = numWings >= 4 ? Math.ceil(wingCounts[3] / 2) : 0;
  const wRowB = numWings >= 4 ? Math.floor(wingCounts[3] / 2) : 0;

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    let posCounter = 1;

    // ── North wing Row A (along X, z = 0, inner courtyard row) ──
    for (let i = 0; i < nRowA; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      const x = i * (UNIT_WIDTH + UNIT_GAP) - courtyardWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, 0);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'south' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'south', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
      posCounter++;
    }

    // ── North wing Row B (along X, z = UNIT_DEPTH + CORRIDOR_WIDTH, outer row) ──
    for (let i = 0; i < nRowB; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
      const x = i * (UNIT_WIDTH + UNIT_GAP) - courtyardWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, UNIT_DEPTH + CORRIDOR_WIDTH);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'north' } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr, 'north', totalUnits);
      addStatusStripe(mesh, status, 'south');
      group.add(mesh);
      posCounter++;
    }

    // North slab (full double-loaded depth, center between the two rows)
    const nSlab = new THREE.Mesh(new THREE.BoxGeometry(northWidth + 0.3, FLOOR_SLAB_HEIGHT, wingDepth + 0.3), MATERIALS.slab.clone());
    nSlab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
    group.add(nSlab);

    // ── East wing Row A (along -Z, x = eastX, inner courtyard row) ──
    if (numWings >= 2) {
      for (let i = 0; i < eRowA; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
        const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
        const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
        mesh.position.set(eastX, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'east' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'east', totalUnits);
        addStatusStripe(mesh, status, 'east');
        group.add(mesh);
        posCounter++;
      }

      // ── East wing Row B (along -Z, x = eastX + UNIT_DEPTH + CORRIDOR_WIDTH, outer row) ──
      for (let i = 0; i < eRowB; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
        const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
        const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
        mesh.position.set(eastX + UNIT_DEPTH + CORRIDOR_WIDTH, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'west' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'west', totalUnits);
        addStatusStripe(mesh, status, 'east');
        group.add(mesh);
        posCounter++;
      }

      // East slab (full double-loaded width in X)
      const eSlab = new THREE.Mesh(new THREE.BoxGeometry(wingDepth + 0.3, FLOOR_SLAB_HEIGHT, vertDepth(wingCounts[1]) + 0.3), MATERIALS.slab.clone());
      eSlab.position.set(eastX + (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, floorY - FLOOR_SLAB_HEIGHT / 2, -(courtyardDepth / 2 + (UNIT_WIDTH + UNIT_GAP) / 2));
      group.add(eSlab);
    }

    // ── South wing Row A (along X, z = southZ, inner courtyard row) ──
    if (numWings >= 3) {
      for (let i = 0; i < sRowA; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
        const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
        const x = i * (UNIT_WIDTH + UNIT_GAP) - courtyardWidth / 2 + UNIT_WIDTH / 2;
        mesh.position.set(x, floorY + UNIT_HEIGHT / 2, southZ);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'north' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'north', totalUnits);
        addStatusStripe(mesh, status, 'north');
        group.add(mesh);
        posCounter++;
      }

      // ── South wing Row B (along X, z = southZ - (UNIT_DEPTH + CORRIDOR_WIDTH), outer row) ──
      for (let i = 0; i < sRowB; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
        const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
        const x = i * (UNIT_WIDTH + UNIT_GAP) - courtyardWidth / 2 + UNIT_WIDTH / 2;
        mesh.position.set(x, floorY + UNIT_HEIGHT / 2, southZ - (UNIT_DEPTH + CORRIDOR_WIDTH));
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'south' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'south', totalUnits);
        addStatusStripe(mesh, status, 'north');
        group.add(mesh);
        posCounter++;
      }

      // South slab (full double-loaded depth)
      const sSlab = new THREE.Mesh(new THREE.BoxGeometry(southWidth + 0.3, FLOOR_SLAB_HEIGHT, wingDepth + 0.3), MATERIALS.slab.clone());
      sSlab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, southZ - (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
      group.add(sSlab);
    }

    // ── West wing Row A (along -Z, x = westX, inner courtyard row) ──
    if (numWings >= 4) {
      for (let i = 0; i < wRowA; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
        const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
        const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
        mesh.position.set(westX, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'west' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'west', totalUnits);
        addStatusStripe(mesh, status, 'west');
        group.add(mesh);
        posCounter++;
      }

      // ── West wing Row B (along -Z, x = westX - (UNIT_DEPTH + CORRIDOR_WIDTH), outer row) ──
      for (let i = 0; i < wRowB; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
        const mesh = new THREE.Mesh(geom, getMaterialForStatus(status));
        const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
        mesh.position.set(westX - (UNIT_DEPTH + CORRIDOR_WIDTH), floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wingDirection: 'east' } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr, 'east', totalUnits);
        addStatusStripe(mesh, status, 'west');
        group.add(mesh);
        posCounter++;
      }

      // West slab (full double-loaded width in X)
      const wSlab = new THREE.Mesh(new THREE.BoxGeometry(wingDepth + 0.3, FLOOR_SLAB_HEIGHT, vertDepth(wingCounts[3]) + 0.3), MATERIALS.slab.clone());
      wSlab.position.set(westX - (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, floorY - FLOOR_SLAB_HEIGHT / 2, -(courtyardDepth / 2 + (UNIT_WIDTH + UNIT_GAP) / 2));
      group.add(wSlab);
    }

    // Window bands between floors (all wings, spanning full double-loaded depth)
    if (floor > 1) {
      addWindowBand(group, northWidth, wingDepth, floorY, 0, (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
      if (numWings >= 2) addWindowBand(group, wingDepth, vertDepth(wingCounts[1]), floorY, eastX + (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, -(courtyardDepth / 2 + (UNIT_WIDTH + UNIT_GAP) / 2));
      if (numWings >= 3) addWindowBand(group, southWidth, wingDepth, floorY, 0, southZ - (UNIT_DEPTH + CORRIDOR_WIDTH) / 2);
      if (numWings >= 4) addWindowBand(group, wingDepth, vertDepth(wingCounts[3]), floorY, westX - (UNIT_DEPTH + CORRIDOR_WIDTH) / 2, -(courtyardDepth / 2 + (UNIT_WIDTH + UNIT_GAP) / 2));
    }
  }

}

function buildBuildingGroup(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  totalUnits: number = 100,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `building_${building.id}`;

  switch (building.shape) {
    case 'L':
      buildLShapeBuilding(building, unitMap, group, totalUnits);
      break;
    case 'U':
      buildUShapeBuilding(building, unitMap, group, totalUnits);
      break;
    case 'courtyard':
    case 'wrap':
      buildCourtyardBuilding(building, unitMap, group, totalUnits);
      break;
    case 'tower':
      buildTowerBuilding(building, unitMap, group, totalUnits);
      break;
    case 'linear':
    default:
      buildLinearBuilding(building, unitMap, group, totalUnits);
      break;
  }

  // Remove unmatched unit meshes (status "unknown") to eliminate "No Data" glass panes.
  // These are positions in the geometry grid that have no corresponding rent roll data.
  const toRemove: THREE.Object3D[] = [];
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.name.startsWith('unit_')) {
      const ud = obj.userData as UnitMeshData;
      if (ud.status === 'unknown' && !ud.rentRollUnit) {
        toRemove.push(obj);
      }
    }
  });
  for (const obj of toRemove) {
    // Dispose geometry and materials to prevent memory leaks
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) obj.material.dispose();
    }
    obj.removeFromParent();
  }

  return group;
}

function createBuildingLabel(text: string, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#A78BFA';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(position);
  sprite.scale.set(5, 1.25, 1);
  return sprite;
}

function addAmenityPads(layout: StackingLayout, scene: THREE.Scene, sceneCenter: THREE.Vector3) {
  const amenitySize = 4;
  let amenityX = sceneCenter.x - ((layout.amenities.length - 1) * (amenitySize + 3)) / 2;
  const amenityZ = sceneCenter.z;

  layout.amenities.forEach((amenity) => {
    const isPool = amenity.type === 'pool';
    const isParking = amenity.type === 'parking';
    const w = isParking ? 8 : amenitySize;
    const d = isParking ? 6 : isPool ? amenitySize : 3;

    const geom = new THREE.BoxGeometry(w, isPool ? 0.05 : 0.15, d);
    const mat = isPool ? MATERIALS.pool.clone() : isParking ? MATERIALS.parking.clone() : MATERIALS.amenity.clone();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(amenityX, isPool ? 0.03 : 0.08, amenityZ);
    mesh.name = `amenity_${amenity.type}`;
    scene.add(mesh);

    const label = createBuildingLabel(
      amenity.type.charAt(0).toUpperCase() + amenity.type.slice(1),
      new THREE.Vector3(mesh.position.x, 1.5, mesh.position.z),
    );
    scene.add(label);
    amenityX += w + 3;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StackingViewer3D({ layout, rentRollUnits, onUnitClick, activeFilter = 'occupancy', asOfDate, checkedFloorPlans, explodedView, isolatedFloor, isFullscreen, onFullscreenToggle, selectedUnits, unitPositionMap }: StackingViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const animationIdRef = useRef<number>(0);
  const materialSnapshotRef = useRef<Map<string, MaterialSnapshot>>(new Map());
  const unitMeshesRef = useRef<THREE.Mesh[]>([]);
  const filterStateRef = useRef<Map<string, MaterialSnapshot>>(new Map());
  const buildUpCompleteRef = useRef(false);
  const maxDimRef = useRef<number>(50);
  const [isReady, setIsReady] = useState(false);
  const [hoveredUnit, setHoveredUnit] = useState<UnitMeshData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current) return;
    // Skip hover logic during orbit drag — prevents accidental dim/highlight
    if (event.buttons !== 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Tooltip position (relative to container)
    setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });

    // Raycasting for hover tooltip
    if (!cameraRef.current || !sceneRef.current) return;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const units = unitMeshesRef.current;
    const intersects = raycasterRef.current.intersectObjects(units, true);

    // Reset ALL units to their filter state (undoes previous dim/highlight)
    if (hoveredRef.current) {
      for (const mesh of units) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        const fs = filterStateRef.current.get(mesh.uuid);
        if (fs) {
          mat.emissiveIntensity = fs.emissiveIntensity;
          mat.opacity = fs.opacity;
        }
        mat.clearcoat = 0.2;
        mat.needsUpdate = true;
      }
      hoveredRef.current = null;
    }

    if (intersects.length > 0) {
      // Walk up to the parent unit mesh if we hit a child (window recess, label, stripe)
      let hitTarget: THREE.Object3D | null = intersects[0].object;
      while (hitTarget && !(hitTarget instanceof THREE.Mesh && hitTarget.name.startsWith('unit_'))) {
        hitTarget = hitTarget.parent;
      }
      const hit = hitTarget as THREE.Mesh | null;
      if (hit && hit.name.startsWith('unit_')) {
        // Highlight hovered unit
        const mat = hit.material as THREE.MeshPhysicalMaterial;
        mat.emissiveIntensity = 0.8;
        mat.opacity = 1.0;
        mat.clearcoat = 0.6;
        mat.needsUpdate = true;

        // Dim all OTHER unit meshes for contrast
        for (const mesh of units) {
          if (mesh === hit) continue;
          const otherMat = mesh.material as THREE.MeshPhysicalMaterial;
          if (otherMat.opacity <= 0.15) continue; // skip floor-plan-dimmed units
          otherMat.opacity = 0.5;
          otherMat.needsUpdate = true;
        }

        hoveredRef.current = hit;
        containerRef.current.style.cursor = 'pointer';
        setHoveredUnit(hit.userData as UnitMeshData);
      }
    } else {
      containerRef.current.style.cursor = 'grab';
      setHoveredUnit(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredUnit(null);
    // ALWAYS restore ALL units to their filter state, regardless of hoveredRef
    // This prevents units staying dimmed when the mouse leaves during a drag
    for (const mesh of unitMeshesRef.current) {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      const fs = filterStateRef.current.get(mesh.uuid);
      if (fs) {
        mat.emissiveIntensity = fs.emissiveIntensity;
        mat.opacity = fs.opacity;
      }
      mat.clearcoat = 0.2;
      mat.needsUpdate = true;
    }
    hoveredRef.current = null;
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleClick = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current || !onUnitClick) return;

    // Ignore click if mouse moved significantly (was a drag, not a click)
    if (mouseDownPosRef.current) {
      const dx = event.clientX - mouseDownPosRef.current.x;
      const dy = event.clientY - mouseDownPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
    }

    // Fresh raycast on click coordinates — don't rely on hoveredRef
    // (hoveredRef may be null because handleMouseMove skips raycasting when buttons are pressed)
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(unitMeshesRef.current, true);

    if (intersects.length > 0) {
      // Walk up to the parent unit mesh if we hit a child (window recess, label, stripe)
      let hitObj: THREE.Object3D | null = intersects[0].object;
      while (hitObj && !(hitObj instanceof THREE.Mesh && hitObj.name.startsWith('unit_'))) {
        hitObj = hitObj.parent;
      }
      if (hitObj && hitObj instanceof THREE.Mesh) {
        onUnitClick(hitObj.userData as UnitMeshData, {
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
        });
      }
    }
  }, [onUnitClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.003);
    sceneRef.current = scene;

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000);
    cameraRef.current = camera;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1a1a2e, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = THREE.MathUtils.degToRad(5);    // 5° — nearly top-down OK
    controls.maxPolarAngle = THREE.MathUtils.degToRad(88);   // 88° — near ground level OK
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controlsRef.current = controls;

    // Stop auto-rotate on first user interaction
    const stopAutoRotate = () => { controls.autoRotate = false; };
    renderer.domElement.addEventListener('pointerdown', stopAutoRotate);
    renderer.domElement.addEventListener('wheel', stopAutoRotate);

    // ── Lighting ──
    const ambient = new THREE.AmbientLight(0x8B8BBA, 0.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xFFF5E6, 0.8);
    keyLight.position.set(50, 80, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.far = 300;
    keyLight.shadow.camera.left = -100;
    keyLight.shadow.camera.right = 100;
    keyLight.shadow.camera.top = 100;
    keyLight.shadow.camera.bottom = -100;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xC4B5FD, 0.3);
    fillLight.position.set(-40, 40, -20);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xA78BFA, 0.2);
    rimLight.position.set(0, 20, -60);
    scene.add(rimLight);

    // ── Build geometry (grid layout) ──
    // Adjust layout floor counts to match inferred floors from rent roll unit numbers
    const adjustedLayout = adjustLayoutForInferredFloors(layout, rentRollUnits);
    const unitMap = matchUnitsToRentRoll(adjustedLayout, rentRollUnits, unitPositionMap);
    const totalUnits = adjustedLayout.buildings.reduce((sum, b) => sum + b.units_per_floor * b.num_floors, 0);
    const cols = Math.max(1, Math.ceil(Math.sqrt(adjustedLayout.buildings.length)));

    // First pass: build all groups and measure their bounding boxes
    const buildingGroups: { group: THREE.Group; building: StackingBuilding; width: number; depth: number }[] = [];
    for (const building of adjustedLayout.buildings) {
      const group = buildBuildingGroup(building, unitMap, totalUnits);
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      box.getSize(size);
      buildingGroups.push({ group, building, width: size.x, depth: size.z });
    }

    // Calculate max width per column and max depth per row
    const maxColWidths: number[] = [];
    const maxRowDepths: number[] = [];
    for (let i = 0; i < buildingGroups.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      maxColWidths[col] = Math.max(maxColWidths[col] || 0, buildingGroups[i].width);
      maxRowDepths[row] = Math.max(maxRowDepths[row] || 0, buildingGroups[i].depth);
    }

    // Calculate total extents for centering
    const totalGridWidth = maxColWidths.reduce((s, w) => s + w, 0) + (maxColWidths.length - 1) * BUILDING_GAP;
    const totalGridDepth = maxRowDepths.reduce((s, d) => s + d, 0) + (maxRowDepths.length - 1) * BUILDING_GAP;

    // Second pass: position buildings in grid
    for (let i = 0; i < buildingGroups.length; i++) {
      const { group, building } = buildingGroups[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      // Sum preceding column widths + gaps
      let x = 0;
      for (let c = 0; c < col; c++) x += maxColWidths[c] + BUILDING_GAP;
      x += maxColWidths[col] / 2 - totalGridWidth / 2;

      let z = 0;
      for (let r = 0; r < row; r++) z += maxRowDepths[r] + BUILDING_GAP;
      z += maxRowDepths[row] / 2 - totalGridDepth / 2;

      group.position.set(x, 0, z);
      scene.add(group);

      // Building label above
      const center = new THREE.Vector3();
      const groupBox = new THREE.Box3().setFromObject(group);
      groupBox.getCenter(center);
      const labelPos = new THREE.Vector3(center.x, building.num_floors * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT) + 1.5, center.z);
      scene.add(createBuildingLabel(building.label, labelPos));

      // Ground shadow plane under building
      const groupSize = new THREE.Vector3();
      groupBox.getSize(groupSize);
      const aoGeom = new THREE.PlaneGeometry(groupSize.x * 1.2, groupSize.z * 1.2);
      const aoMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const aoPlane = new THREE.Mesh(aoGeom, aoMat);
      aoPlane.rotation.x = -Math.PI / 2;
      aoPlane.position.set(center.x, -UNIT_HEIGHT * 0.49, center.z);
      scene.add(aoPlane);
    }

    // ── Fix 1: Post-build label refresh using real unit_numbers from rent roll ──
    // Collect all unit meshes in deterministic order: building order → floor asc → position asc
    const allUnitMeshes: THREE.Mesh[] = [];
    scene.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('unit_')) {
        allUnitMeshes.push(obj);
      }
    });
    const buildingOrder = new Map(adjustedLayout.buildings.map((b, idx) => [b.id, idx]));
    allUnitMeshes.sort((a, b) => {
      const ua = a.userData as UnitMeshData;
      const ub = b.userData as UnitMeshData;
      const aBldgIdx = buildingOrder.get(ua.building_id) ?? 0;
      const bBldgIdx = buildingOrder.get(ub.building_id) ?? 0;
      if (aBldgIdx !== bBldgIdx) return aBldgIdx - bBldgIdx;
      if (ua.floor !== ub.floor) return ua.floor - ub.floor;
      return ua.position - ub.position;
    });

    // Deduplicate rent roll units by id
    const seenRRIds = new Set<number>();
    const dedupedRR = rentRollUnits.filter(u => {
      if (seenRRIds.has(u.id)) return false;
      seenRRIds.add(u.id);
      return true;
    });

    const totalFloors2 = adjustedLayout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);

    // Try floor-aware assignment using same inference as matchUnitsToRentRoll
    const rrWithFloor = dedupedRR.map(u => ({
      unit: u,
      inferredFloor: inferFloorFromUnitNumber(u.unit_number || '', totalFloors2),
    }));
    const inferCount = rrWithFloor.filter(u => u.inferredFloor !== null).length;

    // Detect ground floor (0xx) units and shift all floors up (same as matchUnitsToRentRoll)
    const minFloor2 = rrWithFloor.reduce(
      (m, u) => u.inferredFloor !== null ? Math.min(m, u.inferredFloor) : m, Infinity
    );
    const floorOffset2 = minFloor2 === 0 ? 1 : 0;
    if (floorOffset2) {
      for (const u of rrWithFloor) {
        if (u.inferredFloor !== null) u.inferredFloor += floorOffset2;
      }
    }

    const useFloorAware = inferCount > dedupedRR.length * 0.5;

    const uuidReg = new Map<string, RentRollUnit>();

    if (useFloorAware) {
      // Group meshes by floor
      const meshesByFloor = new Map<number, THREE.Mesh[]>();
      for (const m of allUnitMeshes) {
        const floor = (m.userData as UnitMeshData).floor;
        if (!meshesByFloor.has(floor)) meshesByFloor.set(floor, []);
        meshesByFloor.get(floor)!.push(m);
      }

      // Assign units to meshes on their inferred floor
      for (const [floor, meshes] of meshesByFloor) {
        const floorUnits = rrWithFloor
          .filter(u => u.inferredFloor === floor)
          .sort((a, b) => naturalSort(a.unit.unit_number || '', b.unit.unit_number || ''));
        for (let i = 0; i < Math.min(meshes.length, floorUnits.length); i++) {
          uuidReg.set(meshes[i].uuid, floorUnits[i].unit);
        }
      }

      // Distribute unmatched units to meshes that didn't get a match
      const unmatchedUnits = rrWithFloor
        .filter(u => u.inferredFloor === null || u.inferredFloor > totalFloors2)
        .sort((a, b) => naturalSort(a.unit.unit_number || '', b.unit.unit_number || ''));
      const unmatchedMeshes = allUnitMeshes.filter(m => !uuidReg.has(m.uuid));
      for (let i = 0; i < Math.min(unmatchedMeshes.length, unmatchedUnits.length); i++) {
        uuidReg.set(unmatchedMeshes[i].uuid, unmatchedUnits[i].unit);
      }
    } else {
      // Fallback: sequential assignment
      const sortedRR = [...dedupedRR].sort((a, b) =>
        naturalSort(a.unit_number || '', b.unit_number || ''),
      );
      for (let i = 0; i < Math.min(allUnitMeshes.length, sortedRR.length); i++) {
        uuidReg.set(allUnitMeshes[i].uuid, sortedRR[i]);
      }
    }

    // Log first 10 assignments for verification
    console.log('[StackingViewer3D] First 10 unit label assignments:');
    allUnitMeshes.slice(0, 10).forEach((m, i) => {
      const rr = uuidReg.get(m.uuid);
      console.log(`  [${i}] ${m.name} → unit_number=${rr?.unit_number ?? '(unmatched)'}`);
    });

    // Replace labels on every unit mesh with the matched real unit_number
    for (const mesh of allUnitMeshes) {
      const rr = uuidReg.get(mesh.uuid);
      const ud = mesh.userData as UnitMeshData;
      // Update userData so hover tooltip shows the correct unit_number
      if (rr) ud.rentRollUnit = rr;
      // Remove existing label children
      const toRemove = mesh.children.filter((c: THREE.Object3D) => c.name.startsWith('label_'));
      for (const c of toRemove) {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshBasicMaterial).dispose();
        }
        mesh.remove(c);
      }
      // Re-add label with real unit_number (or positional index as fallback)
      const unitNumber = rr?.unit_number ?? String(ud.position).padStart(3, '0');
      const labelRR = { unit_number: unitNumber } as RentRollUnit;
      addUnitLabel(mesh, labelRR, ud.wingDirection ?? 'south', totalUnits);

      // Add window recess on the exterior face
      addWindowRecess(mesh, ud.wingDirection ?? 'south');
    }

    // ── Floor summary sprites (LOD labels — shown when zoomed out) ──
    const maxFloorCount = layout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);
    const lodSceneBox = new THREE.Box3().setFromObject(scene);
    const sceneCenter2 = new THREE.Vector3();
    lodSceneBox.getCenter(sceneCenter2);

    for (let fl = 1; fl <= maxFloorCount; fl++) {
      const floorUnits = allUnitMeshes.filter(m => (m.userData as UnitMeshData).floor === fl);
      const vacantCount = floorUnits.filter(m => (m.userData as UnitMeshData).status === 'vacant').length;
      const totalCount = floorUnits.length;
      const text = `F${fl}: ${totalCount} units${vacantCount > 0 ? ` · ${vacantCount} vacant` : ''}`;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 64);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(mat);

      const floorY = (fl - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT) + UNIT_HEIGHT / 2;
      sprite.position.set(sceneCenter2.x, floorY, sceneCenter2.z);
      sprite.scale.set(12, 1.5, 1);
      sprite.name = `floor_summary_${fl}`;
      sprite.visible = false;
      sprite.userData._baseY = floorY;
      scene.add(sprite);
    }

    // ── Amenities ──
    // Compute building cluster center for amenity placement
    const buildingBox = new THREE.Box3();
    for (const { group } of buildingGroups) {
      buildingBox.expandByObject(group);
    }
    const clusterCenter = new THREE.Vector3();
    buildingBox.getCenter(clusterCenter);

    if (layout.amenities.length > 0) {
      addAmenityPads(layout, scene, clusterCenter);
    }

    // ── Dynamic ground plane (centered on building cluster) ──
    const sceneBox = new THREE.Box3().setFromObject(scene);
    const sceneSize = new THREE.Vector3();
    sceneBox.getSize(sceneSize);
    const sceneCenter = new THREE.Vector3();
    sceneBox.getCenter(sceneCenter);
    const groundSize = Math.max(sceneSize.x, sceneSize.z) + 40;

    const gridHelper = new THREE.GridHelper(groundSize, Math.max(10, Math.floor(groundSize / 2)), 0x2a2a4a, 0x1a1a3a);
    gridHelper.position.set(sceneCenter.x, -UNIT_HEIGHT * 0.5, sceneCenter.z);
    scene.add(gridHelper);
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const ground = new THREE.Mesh(groundGeom, MATERIALS.ground.clone());
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(sceneCenter.x, -UNIT_HEIGHT * 0.5, sceneCenter.z);
    ground.receiveShadow = true;
    scene.add(ground);

    // ── Collect unit meshes for efficient hover traversal ──
    const collectedUnits: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('unit_') && !obj.name.startsWith('label_')) {
        collectedUnits.push(obj);
      }
    });
    unitMeshesRef.current = collectedUnits;

    // ── Store base Y positions for exploded view ──
    scene.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite) {
        obj.userData._baseY = obj.position.y;
      }
    });

    // ── Material snapshot for safe filter restore (must be BEFORE build-up zeros opacity) ──
    const snapshot = new Map<string, MaterialSnapshot>();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        snapshot.set(obj.uuid, {
          color: mat.color.clone(),
          opacity: mat.opacity,
          emissive: 'emissive' in mat ? mat.emissive.clone() : new THREE.Color(0),
          emissiveIntensity: 'emissiveIntensity' in mat ? (mat as THREE.MeshPhysicalMaterial).emissiveIntensity : 0,
        });
      }
    });
    materialSnapshotRef.current = snapshot;

    // ── Build-up animation: store base opacity, then zero out ──
    buildUpCompleteRef.current = false;
    scene.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite)) return;
      if (obj.name.startsWith('amenity_')) return;
      // Skip ground plane and grid
      if (obj.position.y < -0.1) return;
      const mat = obj.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | THREE.SpriteMaterial;
      if (!mat || typeof mat.opacity !== 'number') return;
      obj.userData._baseOpacity = mat.opacity;
      mat.transparent = true;
      mat.opacity = 0;
      mat.needsUpdate = true;
    });

    // ── Camera position — 32° elevation, 45° azimuth for ground-floor visibility ──
    const maxDim = Math.max(sceneSize.x, sceneSize.z);
    maxDimRef.current = maxDim;
    const cameraDistance = maxDim * 1.05;
    const elevation = THREE.MathUtils.degToRad(32);
    const azimuth = THREE.MathUtils.degToRad(45);

    // Fly-in: start far away, animate to final position
    const startDistance = cameraDistance * 2.5;
    const endPos = new THREE.Vector3(
      sceneCenter.x + cameraDistance * Math.cos(elevation) * Math.sin(azimuth),
      sceneCenter.y + cameraDistance * Math.sin(elevation),
      sceneCenter.z + cameraDistance * Math.cos(elevation) * Math.cos(azimuth),
    );
    const startPos = new THREE.Vector3(
      sceneCenter.x + startDistance * Math.cos(elevation) * Math.sin(azimuth),
      sceneCenter.y + startDistance * Math.sin(elevation) + 5,
      sceneCenter.z + startDistance * Math.cos(elevation) * Math.cos(azimuth),
    );
    camera.position.copy(startPos);
    camera.lookAt(sceneCenter);
    controls.target.copy(sceneCenter);
    controls.minDistance = UNIT_DEPTH * 2;
    controls.maxDistance = cameraDistance * 3;
    controls.update();

    // ── Animate ──
    let flyInFrame = 0;
    let buildUpFrame = 0;
    const FLY_IN_FRAMES = 60;
    const BUILDUP_FRAMES_PER_FLOOR = 15;
    const floorHeightBU = UNIT_HEIGHT + FLOOR_SLAB_HEIGHT;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Fly-in animation (~1 second) — suppress auto-rotate during fly-in
      if (flyInFrame < FLY_IN_FRAMES) {
        controls.autoRotate = false;
        flyInFrame++;
        const ease = easeOutCubic(flyInFrame / FLY_IN_FRAMES);
        camera.position.lerpVectors(startPos, endPos, ease);
        camera.lookAt(sceneCenter);
        if (flyInFrame === FLY_IN_FRAMES) {
          controls.autoRotate = true;
        }
      }

      // Build-up animation: staggered floor reveal after fly-in
      if (flyInFrame >= FLY_IN_FRAMES && !buildUpCompleteRef.current) {
        buildUpFrame++;
        let allDone = true;

        scene.traverse((obj: THREE.Object3D) => {
          if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite)) return;
          if (obj.userData._baseOpacity === undefined) return;

          // Determine floor
          let floor = 1;
          if (obj instanceof THREE.Mesh && obj.name.startsWith('unit_')) {
            floor = (obj.userData as UnitMeshData).floor;
          } else {
            const baseY: number = obj.userData._baseY ?? obj.position.y;
            floor = Math.max(1, Math.round(baseY / floorHeightBU) + 1);
          }

          const floorStart = (floor - 1) * BUILDUP_FRAMES_PER_FLOOR;
          const floorEnd = floor * BUILDUP_FRAMES_PER_FLOOR;
          const baseOpacity: number = obj.userData._baseOpacity;

          if (buildUpFrame >= floorEnd) {
            // Floor fully revealed
            const mat = obj.material as THREE.MeshStandardMaterial;
            mat.opacity = baseOpacity;
            mat.needsUpdate = true;
          } else if (buildUpFrame >= floorStart) {
            // Floor is being revealed
            allDone = false;
            const t = (buildUpFrame - floorStart) / BUILDUP_FRAMES_PER_FLOOR;
            const mat = obj.material as THREE.MeshStandardMaterial;
            mat.opacity = baseOpacity * easeOutCubic(t);
            mat.needsUpdate = true;
          } else {
            allDone = false;
          }
        });

        if (allDone) {
          buildUpCompleteRef.current = true;
          // Capture filter state now that build-up is done and opacities are final
          const filterState = new Map<string, MaterialSnapshot>();
          for (const mesh of unitMeshesRef.current) {
            const mat = mesh.material as THREE.MeshPhysicalMaterial;
            filterState.set(mesh.uuid, {
              color: mat.color.clone(),
              opacity: mat.opacity,
              emissive: mat.emissive.clone(),
              emissiveIntensity: mat.emissiveIntensity ?? 0,
            });
          }
          filterStateRef.current = filterState;
        }
      }

      // LOD labels: toggle between unit labels and floor summaries based on zoom
      if (buildUpCompleteRef.current) {
        const camDist = camera.position.distanceTo(controls.target);
        const lodThreshold = maxDimRef.current * 1.3;
        const showUnitLabels = camDist < lodThreshold;

        scene.traverse((obj) => {
          if (obj.name.startsWith('label_')) obj.visible = showUnitLabels;
          if (obj.name.startsWith('floor_summary_')) obj.visible = !showUnitLabels;
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    setIsReady(true);

    // ── Event listeners ──
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    // ── Resize ──
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animationIdRef.current);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('pointerdown', stopAutoRotate);
      renderer.domElement.removeEventListener('wheel', stopAutoRotate);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if ('map' in m && m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if ('map' in obj.material && obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [layout, rentRollUnits, unitPositionMap, handleMouseDown, handleMouseMove, handleMouseLeave, handleClick]);

  // ── Filter recoloring (no scene rebuild — material color swaps only) ──
  useEffect(() => {
    if (!sceneRef.current) return;
    // Restore all materials to base state before applying new filter colors
    if (materialSnapshotRef.current.size > 0) {
      restoreFromSnapshot(sceneRef.current, materialSnapshotRef.current);
    }
    const stats = computeRentStats(rentRollUnits, layout);
    const refDate = asOfDate ? new Date(asOfDate) : new Date();
    applyFilterToScene(sceneRef.current, activeFilter, stats, refDate);

    // Only capture filter state after build-up is complete
    // During build-up, opacity values are being animated and not reliable
    if (buildUpCompleteRef.current) {
      const filterState = new Map<string, MaterialSnapshot>();
      for (const mesh of unitMeshesRef.current) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        filterState.set(mesh.uuid, {
          color: mat.color.clone(),
          opacity: mat.opacity,
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity ?? 0,
        });
      }
      filterStateRef.current = filterState;
    }
  }, [activeFilter, rentRollUnits, layout, asOfDate]);

  // ── Floor plan opacity layer (dims unchecked floor plans to 15%) ──
  useEffect(() => {
    if (!sceneRef.current || !checkedFloorPlans) return;
    const scene = sceneRef.current;

    scene.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;

      // Handle unit meshes
      if (obj.name.startsWith('unit_')) {
        const ud = obj.userData as UnitMeshData;
        const unitType = ud.rentRollUnit?.unit_type || null;
        const isDimmed = unitType !== null && !checkedFloorPlans.has(unitType);
        const snap = materialSnapshotRef.current.get(obj.uuid);
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.opacity = isDimmed ? 0.15 : (snap?.opacity ?? mat.opacity);
        mat.needsUpdate = true;
      }

      // Handle label meshes — dim alongside their unit
      if (obj.name.startsWith('label_')) {
        const unitName = obj.name.replace('label_', '');
        const parentUnit = scene.getObjectByName(unitName) as THREE.Mesh | undefined;
        if (parentUnit) {
          const ud = parentUnit.userData as UnitMeshData;
          const unitType = ud.rentRollUnit?.unit_type || null;
          const isDimmed = unitType !== null && !checkedFloorPlans.has(unitType);
          const mat = obj.material as THREE.MeshBasicMaterial;
          mat.opacity = isDimmed ? 0.15 : 1.0;
          mat.needsUpdate = true;
        }
      }
    });
  }, [checkedFloorPlans]);

  // ── Exploded view animation ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Force-complete build-up animation if it hasn't finished yet
    if (!buildUpCompleteRef.current) {
      scene.traverse((obj: THREE.Object3D) => {
        if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments)) return;
        if (obj.userData._baseOpacity === undefined) return;
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.opacity = obj.userData._baseOpacity;
        mat.needsUpdate = true;
      });
      buildUpCompleteRef.current = true;
      // Capture filter state now that opacities are final
      const filterState = new Map<string, MaterialSnapshot>();
      for (const mesh of unitMeshesRef.current) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        filterState.set(mesh.uuid, {
          color: mat.color.clone(),
          opacity: mat.opacity,
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity ?? 0,
        });
      }
      filterStateRef.current = filterState;
    }

    const EXPLODE_GAP = UNIT_HEIGHT * 2.5;
    const floorHeight = UNIT_HEIGHT + FLOOR_SLAB_HEIGHT;

    // Collect all objects that need to move, with their start and target Y
    const startPositions = new Map<string, number>();
    const targetPositions = new Map<string, number>();

    scene.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite)) return;
      // Skip ground plane and grid
      if (obj.userData._baseY === undefined) return;
      const baseY: number = obj.userData._baseY;

      // Determine which floor this object belongs to
      let floor = 1;
      if (obj instanceof THREE.Mesh && obj.name.startsWith('unit_')) {
        floor = (obj.userData as UnitMeshData).floor;
      } else if (obj instanceof THREE.Sprite) {
        // Building labels sit above the top floor — move proportionally with max floor
        const maxFloor = layout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);
        floor = maxFloor + 1; // treat labels as above the highest floor
      } else {
        // Infer floor from base Y position
        floor = Math.max(1, Math.round(baseY / floorHeight) + 1);
      }

      const offset = explodedView ? (floor - 1) * EXPLODE_GAP : 0;

      startPositions.set(obj.uuid, obj.position.y);
      targetPositions.set(obj.uuid, baseY + offset);
    });

    // Animate over 30 frames
    let frame = 0;
    const ANIM_FRAMES = 30;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    let animId = 0;

    const animateExplode = () => {
      frame++;
      const t = Math.min(frame / ANIM_FRAMES, 1);
      const ease = easeOutCubic(t);

      scene.traverse((obj: THREE.Object3D) => {
        if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite)) return;
        const start = startPositions.get(obj.uuid);
        const target = targetPositions.get(obj.uuid);
        if (start !== undefined && target !== undefined) {
          obj.position.y = start + (target - start) * ease;
        }
      });

      if (t < 1) {
        animId = requestAnimationFrame(animateExplode);
      }
    };
    animateExplode();

    return () => cancelAnimationFrame(animId);
  }, [explodedView, layout]);

  // ── Floor isolation animation ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const units = unitMeshesRef.current;
    if (!units.length) return;
    const scene = sceneRef.current;
    const floorHeight = UNIT_HEIGHT + FLOOR_SLAB_HEIGHT;

    const ANIM_FRAMES = 20;
    let frame = 0;

    // Capture start opacities and compute targets
    const startOpacities = new Map<string, number>();
    const targetOpacities = new Map<string, number>();

    // Unit meshes
    for (const mesh of units) {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      const ud = mesh.userData as UnitMeshData;
      startOpacities.set(mesh.uuid, mat.opacity);

      if (isolatedFloor === null || isolatedFloor === undefined) {
        const fs = filterStateRef.current.get(mesh.uuid);
        targetOpacities.set(mesh.uuid, fs?.opacity ?? 0.9);
      } else {
        targetOpacities.set(mesh.uuid, ud.floor === isolatedFloor ? (filterStateRef.current.get(mesh.uuid)?.opacity ?? 0.9) : 0.06);
      }
    }

    // Non-unit meshes (slabs, window bands, etc.)
    const nonUnitMeshes: THREE.Mesh[] = [];
    scene.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name.startsWith('unit_')) return;
      if (obj.userData._baseY === undefined) return;
      nonUnitMeshes.push(obj);
      const mat = obj.material as THREE.MeshStandardMaterial;
      startOpacities.set(obj.uuid, mat.opacity);

      if (isolatedFloor === null || isolatedFloor === undefined) {
        targetOpacities.set(obj.uuid, obj.userData._baseOpacity ?? 1.0);
      } else {
        const baseY: number = obj.userData._baseY;
        const inferredFloor = Math.max(1, Math.round(baseY / floorHeight) + 1);
        targetOpacities.set(obj.uuid, inferredFloor === isolatedFloor ? (obj.userData._baseOpacity ?? 1.0) : 0.06);
      }
    });

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    let animId = 0;

    const animateIsolation = () => {
      frame++;
      const t = Math.min(frame / ANIM_FRAMES, 1);
      const ease = easeOutCubic(t);

      for (const mesh of units) {
        const start = startOpacities.get(mesh.uuid) ?? 0.9;
        const target = targetOpacities.get(mesh.uuid) ?? 0.9;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = start + (target - start) * ease;
        mat.needsUpdate = true;
      }

      for (const mesh of nonUnitMeshes) {
        const start = startOpacities.get(mesh.uuid) ?? 1.0;
        const target = targetOpacities.get(mesh.uuid) ?? 1.0;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = start + (target - start) * ease;
        mat.needsUpdate = true;
      }

      if (t < 1) {
        animId = requestAnimationFrame(animateIsolation);
      }
    };
    animateIsolation();

    return () => cancelAnimationFrame(animId);
  }, [isolatedFloor]);

  // ── Selected units highlight (multi-select comparison) ──
  useEffect(() => {
    const units = unitMeshesRef.current;
    if (!units.length) return;

    const selectedIds = new Set((selectedUnits || []).map(u => u.rentRollUnit?.id).filter(Boolean));

    for (const mesh of units) {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      const ud = mesh.userData as UnitMeshData;
      const rrId = ud.rentRollUnit?.id;

      if (selectedIds.size > 0 && rrId && selectedIds.has(rrId)) {
        mat.emissive.set(0x7C3AED);
        mat.emissiveIntensity = 1.0;
        mat.clearcoat = 1.0;
        mat.needsUpdate = true;
      } else {
        // Restore to filter state
        const fs = filterStateRef.current.get(mesh.uuid);
        if (fs) {
          mat.emissive.copy(fs.emissive);
          mat.emissiveIntensity = fs.emissiveIntensity;
        }
        mat.clearcoat = 0.2;
        mat.needsUpdate = true;
      }
    }
  }, [selectedUnits]);

  // ── Fullscreen resize ──
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = isFullscreen ? window.innerHeight : 540;
    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [isFullscreen]);

  // ── Screenshot export ──
  const handleScreenshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `ASTRA-stacking-${layout.buildings.map(b => b.label).join('-')}-${activeFilter}.png`;
    link.href = dataUrl;
    link.click();
  }, [layout, activeFilter]);

  // ── In-canvas stats overlay ──
  const filterStats = useMemo(() => {
    // Deduplicate by unit id to handle any residual DB duplicates
    const seen = new Set<number>();
    const uniqueUnits = rentRollUnits.filter(u => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
    const total = uniqueUnits.length;
    const occupied = uniqueUnits.filter(u => u.is_occupied === true || (u.status || '').toLowerCase().includes('occupied')).length;
    const vacant = uniqueUnits.filter(u => u.is_occupied === false || (u.status || '').toLowerCase().includes('vacant')).length;

    switch (activeFilter) {
      case 'occupancy':
        return `${occupied} Occupied · ${vacant} Vacant · ${total > 0 ? ((occupied / total) * 100).toFixed(1) : 0}%`;
      case 'loss_to_lease': {
        const withLTL = uniqueUnits.filter(u => u.market_rent && u.in_place_rent && u.market_rent > 0);
        const avgGap = withLTL.length > 0
          ? withLTL.reduce((s, u) => s + (u.market_rent! - u.in_place_rent!), 0) / withLTL.length
          : 0;
        const highLTL = withLTL.filter(u => ((u.market_rent! - u.in_place_rent!) / u.market_rent!) > 0.10).length;
        return `$${Math.round(avgGap)}/unit avg. gap · ${highLTL} units >10% LTL`;
      }
      case 'expirations': {
        const refDate = asOfDate ? new Date(asOfDate) : new Date();
        const soon30 = uniqueUnits.filter(u => {
          if (!u.lease_end) return false;
          const diff = (new Date(u.lease_end).getTime() - refDate.getTime()) / (1000*60*60*24);
          return diff <= 30;
        }).length;
        const soon90 = uniqueUnits.filter(u => {
          if (!u.lease_end) return false;
          const diff = (new Date(u.lease_end).getTime() - refDate.getTime()) / (1000*60*60*24);
          return diff <= 90;
        }).length;
        return `${soon30} expiring ≤30d · ${soon90} expiring ≤90d`;
      }
      case 'market_rents': {
        const withRent = uniqueUnits.filter(u => u.market_rent != null);
        const avg = withRent.length > 0 ? withRent.reduce((s, u) => s + u.market_rent!, 0) / withRent.length : 0;
        return `$${Math.round(avg).toLocaleString()} avg. market rent · ${withRent.length} units`;
      }
      case 'contract_rents': {
        const withRent = uniqueUnits.filter(u => u.in_place_rent != null && u.in_place_rent > 0);
        const avg = withRent.length > 0 ? withRent.reduce((s, u) => s + u.in_place_rent!, 0) / withRent.length : 0;
        return `$${Math.round(avg).toLocaleString()} avg. in-place rent · ${withRent.length} units`;
      }
      case 'floor_level': {
        const maxFloor = layout.buildings.reduce((m, b) => Math.max(m, b.num_floors), 1);
        return `${layout.buildings.length} building${layout.buildings.length > 1 ? 's' : ''} · ${maxFloor} floors · ${total} units`;
      }
      default:
        return `${total} units`;
    }
  }, [activeFilter, rentRollUnits, layout, asOfDate]);

  const rr = hoveredUnit?.rentRollUnit;

  return (
    <div className={cn("relative", isFullscreen && "fixed inset-0 z-[9999] bg-background")}>
      <div
        ref={containerRef}
        className="w-full rounded-l-2xl overflow-hidden border border-border/60"
        style={{ height: isFullscreen ? '100vh' : 540 }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
          <p className="text-muted-foreground text-sm">Loading 3D viewer...</p>
        </div>
      )}

      {/* In-canvas stats overlay */}
      {isReady && (
        <div className="absolute top-3 left-3 bg-card/70 backdrop-blur-md border border-border/40 rounded-lg px-3 py-2 pointer-events-none">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase mb-0.5">
            {activeFilter?.replace(/_/g, ' ') || 'Occupancy'}
          </p>
          <p className="text-xs font-mono text-foreground/90">
            {filterStats}
          </p>
        </div>
      )}

      {/* Floating tooltip */}
      {hoveredUnit && (
        <div
          className="absolute pointer-events-none z-10 bg-card/95 backdrop-blur-sm border border-border/60 rounded-xl shadow-2xl p-3 min-w-[220px] max-w-[280px] text-sm"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -110%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-foreground">
              Unit {rr?.unit_number || '—'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              hoveredUnit.status === 'occupied'
                ? 'bg-primary/20 text-primary'
                : hoveredUnit.status === 'vacant'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {hoveredUnit.status === 'occupied' ? 'Occupied' : hoveredUnit.status === 'vacant' ? 'Vacant' : 'Unknown'}
            </span>
          </div>

          {/* Data grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">Floor</span>
              <p className="font-mono font-semibold text-foreground">{hoveredUnit.floor}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-mono font-semibold text-foreground">{rr?.unit_type || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Market Rent</span>
              <p className="font-mono font-semibold text-foreground">
                {rr?.market_rent ? `$${rr.market_rent.toLocaleString()}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">In-Place Rent</span>
              <p className="font-mono font-semibold text-foreground">
                {rr?.in_place_rent && rr.in_place_rent > 0 ? `$${rr.in_place_rent.toLocaleString()}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Loss-to-Lease</span>
              <p className="font-mono font-semibold text-foreground">
                {formatLTL(rr?.market_rent, rr?.in_place_rent)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">SQFT</span>
              <p className="font-mono font-semibold text-foreground">
                {rr?.sqft ? rr.sqft.toLocaleString() : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Lease End</span>
              <p className="font-mono font-semibold text-foreground">
                {rr?.lease_end
                  ? new Date(rr.lease_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-mono font-semibold text-foreground">{rr?.status || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen toggle button */}
      {isReady && onFullscreenToggle && (
        <button
          onClick={onFullscreenToggle}
          className="absolute top-3 right-3 p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/90 transition-colors z-20"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}

      {/* Screenshot button */}
      {isReady && (
        <button
          onClick={handleScreenshot}
          className="absolute bottom-3 right-3 p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/90 transition-colors"
          title="Download screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}

      {/* Help text overlay */}
      <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/50 pointer-events-none">
        Hover for details · Click for unit info · Ctrl+Click to compare · Drag to rotate · Keys: 1-6 filters · E explode · F fullscreen
      </div>
    </div>
  );
}
