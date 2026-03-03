/**
 * StackingViewer3D — Three.js procedural building renderer.
 * Generates 3D geometry from a StackingLayout, with interactive
 * raycasting for hover/click on individual units.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { StackingLayout, StackingBuilding, RentRollUnit, StackingFilterType } from '@/types/property';

// ─── Constants ───────────────────────────────────────────────────────────────
const UNIT_WIDTH = 4;
const UNIT_HEIGHT = 1.5;
const UNIT_DEPTH = 6;
const UNIT_GAP = 0.2;
const FLOOR_SLAB_HEIGHT = 0.1;
const BUILDING_GAP = 20;

// ─── Material palette — investor-grade dark theme ────────────────────────────
const MATERIALS = {
  // Occupied unit: rich purple glass effect
  occupied: new THREE.MeshPhysicalMaterial({
    color: 0x7C3AED,
    metalness: 0.1,
    roughness: 0.4,
    transparent: true,
    opacity: 0.88,
    emissive: 0x4C1D95,
    emissiveIntensity: 0.15,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  }),
  // Vacant unit: warm rose/coral with slight glow
  vacant: new THREE.MeshPhysicalMaterial({
    color: 0xF43F5E,
    metalness: 0.1,
    roughness: 0.5,
    transparent: true,
    opacity: 0.88,
    emissive: 0xBE123C,
    emissiveIntensity: 0.2,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
  }),
  // No data: neutral dark with subtle sheen
  noData: new THREE.MeshPhysicalMaterial({
    color: 0x3F3F5A,
    metalness: 0.15,
    roughness: 0.6,
    transparent: true,
    opacity: 0.75,
    emissive: 0x1E1E3A,
    emissiveIntensity: 0.05,
  }),
  // Floor slab: dark concrete look
  slab: new THREE.MeshStandardMaterial({
    color: 0x1A1A2E,
    metalness: 0.3,
    roughness: 0.8,
    transparent: true,
    opacity: 0.6,
  }),
  // Pool: translucent cyan water
  pool: new THREE.MeshPhysicalMaterial({
    color: 0x22D3EE,
    metalness: 0.0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
    emissive: 0x0891B2,
    emissiveIntensity: 0.3,
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
    opacity: 0.8,
  }),
};

// Edge line material for unit borders
const EDGE_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: 0x1E1B4B,
  transparent: true,
  opacity: 0.4,
});

export interface UnitMeshData {
  building_id: string;
  building_label: string;
  floor: number;
  position: number;
  status: 'occupied' | 'vacant' | 'unknown';
  rentRollUnit?: RentRollUnit;
}

interface StackingViewer3DProps {
  layout: StackingLayout;
  rentRollUnits: RentRollUnit[];
  onUnitClick?: (data: UnitMeshData) => void;
  activeFilter?: StackingFilterType;
  asOfDate?: string | null;
}

// ─── Matching logic ──────────────────────────────────────────────────────────

function matchUnitsToRentRoll(
  layout: StackingLayout,
  rentRollUnits: RentRollUnit[],
): Map<string, RentRollUnit> {
  const map = new Map<string, RentRollUnit>();
  if (!rentRollUnits.length) return map;

  // Build a flat list of model unit keys in order: building → floor → position
  const modelKeys: string[] = [];
  for (const bldg of layout.buildings) {
    for (let floor = 1; floor <= bldg.num_floors; floor++) {
      for (let pos = 1; pos <= bldg.units_per_floor; pos++) {
        modelKeys.push(`${bldg.id}_${floor}_${pos}`);
      }
    }
  }

  // Try floor-prefix matching (e.g., "101" → floor 1, unit 01)
  const unitsWithFloorPrefix = rentRollUnits.filter((u) => {
    if (!u.unit_number) return false;
    const num = u.unit_number.replace(/[^0-9]/g, '');
    return num.length >= 2;
  });

  if (unitsWithFloorPrefix.length >= rentRollUnits.length * 0.5) {
    // Enough units have parseable numbers — use floor-prefix matching
    const sorted = [...rentRollUnits].sort((a, b) => {
      const aNum = (a.unit_number || '').replace(/[^0-9]/g, '');
      const bNum = (b.unit_number || '').replace(/[^0-9]/g, '');
      return aNum.localeCompare(bNum, undefined, { numeric: true });
    });

    for (let i = 0; i < Math.min(sorted.length, modelKeys.length); i++) {
      map.set(modelKeys[i], sorted[i]);
    }
  } else {
    // Sequential matching
    for (let i = 0; i < Math.min(rentRollUnits.length, modelKeys.length); i++) {
      map.set(modelKeys[i], rentRollUnits[i]);
    }
  }

  return map;
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

// ─── Unit number label textures ─────────────────────────────────────────────

function createUnitNumberTexture(unitNumber: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 64);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 28px monospace';
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

function addUnitLabel(mesh: THREE.Mesh, rr: RentRollUnit | undefined) {
  const unitNumber = rr?.unit_number;
  if (!unitNumber) return;

  // Read actual geometry dimensions (handles rotated boxes like UNIT_DEPTH x H x UNIT_WIDTH)
  const geomBox = new THREE.Box3();
  mesh.geometry.computeBoundingBox();
  geomBox.copy(mesh.geometry.boundingBox!);
  const sz = new THREE.Vector3();
  geomBox.getSize(sz);

  const labelTexture = createUnitNumberTexture(unitNumber);
  const labelMat = new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
  const labelGeom = new THREE.PlaneGeometry(sz.x * 0.85, sz.y * 0.7);
  const labelMesh = new THREE.Mesh(labelGeom, labelMat);
  labelMesh.position.set(0, 0, sz.z / 2 + 0.01);
  labelMesh.name = `label_${mesh.name}`;
  mesh.add(labelMesh);
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

function getFloorPlanColor(unitType: string | null | undefined): THREE.Color {
  if (!unitType) return new THREE.Color(0x6B7280);
  const t = unitType.toLowerCase();
  if (t.includes('studio') || t.includes('stu')) return new THREE.Color(0xF59E0B);
  if (t.includes('3') && (t.includes('br') || t.includes('bed'))) return new THREE.Color(0x10B981);
  if (t.includes('2') && (t.includes('br') || t.includes('bed'))) return new THREE.Color(0x8B5CF6);
  if (t.includes('1') && (t.includes('br') || t.includes('bed'))) return new THREE.Color(0x3B82F6);
  return new THREE.Color(0x6B7280);
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
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.name.startsWith('unit_')) return;
    const ud = obj.userData as UnitMeshData;
    const mat = obj.material as THREE.MeshPhysicalMaterial;

    let color: THREE.Color;
    switch (filterType) {
      case 'occupancy':
        color = statusToColor(ud.status);
        break;
      case 'floor_level':
        color = lerpColor(0x1E3A5F, 0x38BDF8, (ud.floor - 1) / Math.max(stats.maxFloor - 1, 1));
        break;
      case 'floor_plan':
        color = getFloorPlanColor(ud.rentRollUnit?.unit_type);
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

    mat.color.copy(color);
    mat.emissive.copy(color).multiplyScalar(0.15);
    mat.needsUpdate = true;
  });
}

// ─── Geometry builders ──────────────────────────────────────────────────────

function buildLinearBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
) {
  const unitsPerFloor = building.units_per_floor;
  const totalWidth = unitsPerFloor * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);

    // Floor slab
    const slabGeom = new THREE.BoxGeometry(totalWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3);
    const slab = new THREE.Mesh(slabGeom, MATERIALS.slab.clone());
    slab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slab);

    // Units
    for (let pos = 1; pos <= unitsPerFloor; pos++) {
      const key = `${building.id}_${floor}_${pos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);

      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);

      const x = (pos - 1) * (UNIT_WIDTH + UNIT_GAP) - totalWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, 0);

      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = {
        building_id: building.id,
        building_label: building.label,
        floor,
        position: pos,
        status,
        rentRollUnit: rr,
      } satisfies UnitMeshData;

      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
    }
  }

}

function buildLShapeBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
) {
  const halfUnits = building.wings?.[0]?.units_per_floor ?? Math.ceil(building.units_per_floor / 2);
  const otherHalf = building.wings?.[1]?.units_per_floor ?? (building.units_per_floor - halfUnits);

  // Wing 1: along X axis
  const wing1Width = halfUnits * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  // Wing 2: along Z axis
  const wing2Depth = otherHalf * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  let unitCounter = 0;

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);

    // Slab for wing 1
    const slab1Geom = new THREE.BoxGeometry(wing1Width + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3);
    const slab1 = new THREE.Mesh(slab1Geom, MATERIALS.slab.clone());
    slab1.position.set(wing1Width / 2, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slab1);

    // Slab for wing 2
    const slab2Geom = new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wing2Depth + 0.3);
    const slab2 = new THREE.Mesh(slab2Geom, MATERIALS.slab.clone());
    slab2.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, -(wing2Depth / 2 + UNIT_DEPTH / 2 + UNIT_GAP));
    group.add(slab2);

    // Wing 1 units (along X)
    for (let i = 0; i < halfUnits; i++) {
      unitCounter++;
      const pos = unitCounter - (floor - 1) * building.units_per_floor;
      const key = `${building.id}_${floor}_${pos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);

      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);

      mesh.position.set(i * (UNIT_WIDTH + UNIT_GAP), floorY + UNIT_HEIGHT / 2, 0);
      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: pos, status, rentRollUnit: rr } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
    }

    // Wing 2 units (along -Z)
    for (let i = 0; i < otherHalf; i++) {
      unitCounter++;
      const pos = unitCounter - (floor - 1) * building.units_per_floor;
      const key = `${building.id}_${floor}_${pos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);

      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);

      const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
      mesh.position.set(0, floorY + UNIT_HEIGHT / 2, z);
      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: pos, status, rentRollUnit: rr } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
    }

    unitCounter = floor * building.units_per_floor;
  }

}

function buildUShapeBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
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

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    let posCounter = 1;

    // Left wing (along -Z)
    for (let i = 0; i < wings[0]; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(-(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP), floorY + UNIT_HEIGHT / 2, -i * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
      posCounter++;
    }

    // Bottom wing (along X, connecting the two vertical wings)
    const bottomZ = -(wings[0] - 1) * (UNIT_WIDTH + UNIT_GAP) - UNIT_WIDTH / 2 - UNIT_GAP;
    for (let i = 0; i < wings[1]; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);
      const x = i * (UNIT_WIDTH + UNIT_GAP) - maxWingWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, bottomZ);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
      posCounter++;
    }

    // Right wing (along +Z, going back up)
    for (let i = 0; i < wings[2]; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP, floorY + UNIT_HEIGHT / 2, -(wings[0] - 1 - i) * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
      posCounter++;
    }

    // Floor slabs (one for each wing)
    const slab1 = new THREE.Mesh(new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wingWidth(wings[0]) + 0.3), MATERIALS.slab.clone());
    slab1.position.set(-(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP), floorY - FLOOR_SLAB_HEIGHT / 2, -(wings[0] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    group.add(slab1);

    const slab2 = new THREE.Mesh(new THREE.BoxGeometry(maxWingWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3), MATERIALS.slab.clone());
    slab2.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, bottomZ);
    group.add(slab2);

    const slab3 = new THREE.Mesh(new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wingWidth(wings[2]) + 0.3), MATERIALS.slab.clone());
    slab3.position.set(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP, floorY - FLOOR_SLAB_HEIGHT / 2, -(wings[2] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    group.add(slab3);
  }

}

function buildTowerBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
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
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr);
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
    // Last wing absorbs rounding remainder to preserve exact total
    wingCounts[3] = totalPerFloor - longSide - shortSide - longSide;
  }

  // Calculate horizontal wing width (north/south wings along X)
  const horizWidth = (units: number) => units * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  // Calculate vertical wing depth (east/west wings along Z)
  const vertDepth = (units: number) => units * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  // Courtyard dimensions — based on max horizontal/vertical wing sizes
  const northWidth = horizWidth(wingCounts[0]);
  const eastDepth = numWings >= 2 ? vertDepth(wingCounts[1]) : 0;
  const southWidth = numWings >= 3 ? horizWidth(wingCounts[2]) : 0;
  const westDepth = numWings >= 4 ? vertDepth(wingCounts[3]) : eastDepth;

  const courtyardWidth = Math.max(northWidth, southWidth);
  const courtyardDepth = Math.max(eastDepth, westDepth);

  // Offsets: east/west wings sit outside the horizontal wings
  const eastX = courtyardWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP;
  const westX = -(courtyardWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP);

  // South wing sits below the courtyard
  const southZ = -(courtyardDepth + UNIT_DEPTH + UNIT_GAP * 2);

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    let posCounter = 1;

    // ── North wing (along X, Z = 0) ──
    for (let i = 0; i < wingCounts[0]; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = getMaterialForStatus(status);
      const mesh = new THREE.Mesh(geom, mat);
      const x = i * (UNIT_WIDTH + UNIT_GAP) - courtyardWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, 0);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
      addUnitEdges(mesh, geom);
      addUnitLabel(mesh, rr);
      group.add(mesh);
      posCounter++;
    }
    // North slab
    const nSlab = new THREE.Mesh(new THREE.BoxGeometry(northWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3), MATERIALS.slab.clone());
    nSlab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(nSlab);

    // ── East wing (along -Z, X = eastX) ──
    if (numWings >= 2) {
      for (let i = 0; i < wingCounts[1]; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
        const mat = getMaterialForStatus(status);
        const mesh = new THREE.Mesh(geom, mat);
        const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
        mesh.position.set(eastX, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr);
        group.add(mesh);
        posCounter++;
      }
      // East slab
      const eSlab = new THREE.Mesh(new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, vertDepth(wingCounts[1]) + 0.3), MATERIALS.slab.clone());
      eSlab.position.set(eastX, floorY - FLOOR_SLAB_HEIGHT / 2, -(courtyardDepth / 2 + (UNIT_WIDTH + UNIT_GAP) / 2));
      group.add(eSlab);
    }

    // ── South wing (along X, Z = southZ) ──
    if (numWings >= 3) {
      for (let i = 0; i < wingCounts[2]; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
        const mat = getMaterialForStatus(status);
        const mesh = new THREE.Mesh(geom, mat);
        const x = i * (UNIT_WIDTH + UNIT_GAP) - courtyardWidth / 2 + UNIT_WIDTH / 2;
        mesh.position.set(x, floorY + UNIT_HEIGHT / 2, southZ);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr);
        group.add(mesh);
        posCounter++;
      }
      // South slab
      const sSlab = new THREE.Mesh(new THREE.BoxGeometry(southWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3), MATERIALS.slab.clone());
      sSlab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, southZ);
      group.add(sSlab);
    }

    // ── West wing (along -Z, X = westX) ──
    if (numWings >= 4) {
      for (let i = 0; i < wingCounts[3]; i++) {
        const key = `${building.id}_${floor}_${posCounter}`;
        const rr = unitMap.get(key);
        const status = getUnitStatus(rr);
        const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
        const mat = getMaterialForStatus(status);
        const mesh = new THREE.Mesh(geom, mat);
        const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
        mesh.position.set(westX, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
        addUnitEdges(mesh, geom);
        addUnitLabel(mesh, rr);
        group.add(mesh);
        posCounter++;
      }
      // West slab
      const wSlab = new THREE.Mesh(new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, vertDepth(wingCounts[3]) + 0.3), MATERIALS.slab.clone());
      wSlab.position.set(westX, floorY - FLOOR_SLAB_HEIGHT / 2, -(courtyardDepth / 2 + (UNIT_WIDTH + UNIT_GAP) / 2));
      group.add(wSlab);
    }
  }

}

function buildBuildingGroup(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `building_${building.id}`;

  switch (building.shape) {
    case 'L':
      buildLShapeBuilding(building, unitMap, group);
      break;
    case 'U':
      buildUShapeBuilding(building, unitMap, group);
      break;
    case 'courtyard':
    case 'wrap':
      buildCourtyardBuilding(building, unitMap, group);
      break;
    case 'tower':
      buildTowerBuilding(building, unitMap, group);
      break;
    case 'linear':
    default:
      buildLinearBuilding(building, unitMap, group);
      break;
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

    const geom = new THREE.BoxGeometry(w, 0.15, d);
    const mat = isPool ? MATERIALS.pool.clone() : isParking ? MATERIALS.parking.clone() : MATERIALS.amenity.clone();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(amenityX, 0.08, amenityZ);
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

export function StackingViewer3D({ layout, rentRollUnits, onUnitClick, activeFilter = 'occupancy', asOfDate }: StackingViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [hoveredUnit, setHoveredUnit] = useState<UnitMeshData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Tooltip position (relative to container)
    setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });

    // Raycasting for hover tooltip
    if (!cameraRef.current || !sceneRef.current) return;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const unitMeshes: THREE.Mesh[] = [];
    sceneRef.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('unit_') && !obj.name.startsWith('label_')) {
        unitMeshes.push(obj);
      }
    });
    const intersects = raycasterRef.current.intersectObjects(unitMeshes);

    // Reset previous hover
    if (hoveredRef.current) {
      const mat = hoveredRef.current.material as THREE.MeshPhysicalMaterial;
      const status = (hoveredRef.current.userData as UnitMeshData).status;
      mat.emissiveIntensity = status === 'vacant' ? 0.2 : status === 'occupied' ? 0.15 : 0.05;
      mat.opacity = status === 'unknown' ? 0.75 : 0.88;
      hoveredRef.current = null;
    }

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      if (hit.name.startsWith('unit_')) {
        const mat = hit.material as THREE.MeshPhysicalMaterial;
        mat.emissiveIntensity = 0.6;
        mat.opacity = 1.0;
        hoveredRef.current = hit;
        containerRef.current.style.cursor = 'pointer';
        const ud = hit.userData as UnitMeshData;
        setHoveredUnit(ud);
      }
    } else {
      containerRef.current.style.cursor = 'grab';
      setHoveredUnit(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredUnit(null);
    if (hoveredRef.current) {
      const mat = hoveredRef.current.material as THREE.MeshPhysicalMaterial;
      const status = (hoveredRef.current.userData as UnitMeshData).status;
      mat.emissiveIntensity = status === 'vacant' ? 0.2 : status === 'occupied' ? 0.15 : 0.05;
      mat.opacity = status === 'unknown' ? 0.75 : 0.88;
      hoveredRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredRef.current?.userData?.building_id && onUnitClick) {
      onUnitClick(hoveredRef.current.userData as UnitMeshData);
    }
  }, [onUnitClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080814);
    scene.fog = new THREE.FogExp2(0x080814, 0.003);
    sceneRef.current = scene;

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000);
    cameraRef.current = camera;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x080814, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controlsRef.current = controls;

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
    const unitMap = matchUnitsToRentRoll(layout, rentRollUnits);
    const cols = Math.max(1, Math.ceil(Math.sqrt(layout.buildings.length)));

    // First pass: build all groups and measure their bounding boxes
    const buildingGroups: { group: THREE.Group; building: StackingBuilding; width: number; depth: number }[] = [];
    for (const building of layout.buildings) {
      const group = buildBuildingGroup(building, unitMap);
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
      new THREE.Box3().setFromObject(group).getCenter(center);
      const labelPos = new THREE.Vector3(center.x, building.num_floors * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT) + 1.5, center.z);
      scene.add(createBuildingLabel(building.label, labelPos));
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
    gridHelper.position.set(sceneCenter.x, 0, sceneCenter.z);
    scene.add(gridHelper);
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const ground = new THREE.Mesh(groundGeom, MATERIALS.ground.clone());
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(sceneCenter.x, -0.05, sceneCenter.z);
    ground.receiveShadow = true;
    scene.add(ground);

    // ── Camera position (based on pre-ground scene bounds) ──
    const maxDim = Math.max(sceneSize.x, sceneSize.z);
    const cameraDistance = maxDim * 1.5;

    camera.position.set(
      sceneCenter.x + cameraDistance * 0.6,
      cameraDistance * 0.7,
      sceneCenter.z + cameraDistance * 0.6,
    );
    camera.lookAt(sceneCenter);
    controls.target.copy(sceneCenter);
    controls.update();

    // ── Animate ──
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    setIsReady(true);

    // ── Event listeners ──
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
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
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
  }, [layout, rentRollUnits, handleMouseMove, handleMouseLeave, handleClick]);

  // ── Filter recoloring (no scene rebuild — material color swaps only) ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const stats = computeRentStats(rentRollUnits, layout);
    const refDate = asOfDate ? new Date(asOfDate) : new Date();
    applyFilterToScene(sceneRef.current, activeFilter, stats, refDate);
  }, [activeFilter, rentRollUnits, layout, asOfDate]);

  const rr = hoveredUnit?.rentRollUnit;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-l-2xl overflow-hidden border border-border/60"
        style={{ height: 480 }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
          <p className="text-muted-foreground text-sm">Loading 3D viewer...</p>
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

      {/* Help text overlay */}
      <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/50 pointer-events-none">
        Hover a unit for details · Drag to rotate
      </div>
    </div>
  );
}
