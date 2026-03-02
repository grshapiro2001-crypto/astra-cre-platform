/**
 * StackingViewer3D — Three.js procedural building renderer.
 * Generates 3D geometry from a StackingLayout, with interactive
 * raycasting for hover/click on individual units.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { StackingLayout, StackingBuilding, RentRollUnit } from '@/types/property';

// ─── Constants ───────────────────────────────────────────────────────────────
const UNIT_WIDTH = 4;
const UNIT_HEIGHT = 1.5;
const UNIT_DEPTH = 6;
const UNIT_GAP = 0.2;
const FLOOR_SLAB_HEIGHT = 0.1;
const BUILDING_GAP = 20;

// Purple primary: hsl(267, 84%, 60%) → roughly #8B5CF6
const COLOR_OCCUPIED = new THREE.Color(0x8B5CF6);
const COLOR_VACANT = new THREE.Color(0xF43F5E);
const COLOR_UNKNOWN = new THREE.Color(0x6B7280);
const COLOR_SLAB = new THREE.Color(0x374151);
const COLOR_AMENITY = new THREE.Color(0x6366F1);
const COLOR_GROUND = new THREE.Color(0x1a1a2e);
const COLOR_HOVER_EMISSIVE = new THREE.Color(0xA78BFA);

export interface UnitMeshData {
  building_id: string;
  building_label: string;
  floor: number;
  position: number;
  status: 'occupied' | 'vacant' | 'unknown';
  rentRollUnit?: RentRollUnit;
  wing?: string;
}

interface StackingViewer3DProps {
  layout: StackingLayout;
  rentRollUnits: RentRollUnit[];
  onUnitClick: (data: UnitMeshData) => void;
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

function getColorForStatus(status: 'occupied' | 'vacant' | 'unknown'): THREE.Color {
  switch (status) {
    case 'occupied': return COLOR_OCCUPIED;
    case 'vacant': return COLOR_VACANT;
    case 'unknown': return COLOR_UNKNOWN;
  }
}

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
    const slabMat = new THREE.MeshStandardMaterial({ color: COLOR_SLAB });
    const slab = new THREE.Mesh(slabGeom, slabMat);
    slab.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slab);

    // Units
    for (let pos = 1; pos <= unitsPerFloor; pos++) {
      const key = `${building.id}_${floor}_${pos}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const color = getColorForStatus(status);

      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.88 });
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

      group.add(mesh);
    }
  }

  // Roof slab
  const roofY = building.num_floors * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
  const roofGeom = new THREE.BoxGeometry(totalWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3);
  const roofMat = new THREE.MeshStandardMaterial({ color: COLOR_SLAB });
  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.position.set(0, roofY - FLOOR_SLAB_HEIGHT / 2, 0);
  group.add(roof);
}

function buildLShapeBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
) {
  const bwingsL = building.wings;
  const halfUnits = bwingsL && bwingsL.length >= 2 ? bwingsL[0].units_per_floor : Math.ceil(building.units_per_floor / 2);
  const otherHalf = bwingsL && bwingsL.length >= 2 ? bwingsL[1].units_per_floor : building.units_per_floor - halfUnits;

  // Wing 1: along X axis
  const wing1Width = halfUnits * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;
  // Wing 2: along Z axis
  const wing2Depth = otherHalf * (UNIT_WIDTH + UNIT_GAP) - UNIT_GAP;

  let unitCounter = 0;

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);

    // Slab for wing 1
    const slab1Geom = new THREE.BoxGeometry(wing1Width + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3);
    const slab1 = new THREE.Mesh(slab1Geom, new THREE.MeshStandardMaterial({ color: COLOR_SLAB }));
    slab1.position.set(wing1Width / 2, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slab1);

    // Slab for wing 2
    const slab2Geom = new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wing2Depth + 0.3);
    const slab2 = new THREE.Mesh(slab2Geom, new THREE.MeshStandardMaterial({ color: COLOR_SLAB }));
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
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);

      mesh.position.set(i * (UNIT_WIDTH + UNIT_GAP), floorY + UNIT_HEIGHT / 2, 0);
      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: pos, status, rentRollUnit: rr } satisfies UnitMeshData;
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
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);

      const z = -(i + 1) * (UNIT_WIDTH + UNIT_GAP);
      mesh.position.set(0, floorY + UNIT_HEIGHT / 2, z);
      mesh.name = `unit_${building.id}_${floor}_${pos}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: pos, status, rentRollUnit: rr } satisfies UnitMeshData;
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
  // Split units across 3 wings (use wings data if available)
  const bwingsU = building.wings;
  let wings: number[];
  if (bwingsU && bwingsU.length >= 3) {
    wings = bwingsU.slice(0, 3).map((w) => w.units_per_floor);
  } else {
    const wingUnits = Math.floor(building.units_per_floor / 3);
    const remainder = building.units_per_floor - wingUnits * 3;
    wings = [wingUnits + (remainder > 0 ? 1 : 0), wingUnits + (remainder > 1 ? 1 : 0), wingUnits];
  }

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
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(-(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP), floorY + UNIT_HEIGHT / 2, -i * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
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
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      const x = i * (UNIT_WIDTH + UNIT_GAP) - maxWingWidth / 2 + UNIT_WIDTH / 2;
      mesh.position.set(x, floorY + UNIT_HEIGHT / 2, bottomZ);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
      group.add(mesh);
      posCounter++;
    }

    // Right wing (along +Z, going back up)
    for (let i = 0; i < wings[2]; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP, floorY + UNIT_HEIGHT / 2, -(wings[0] - 1 - i) * (UNIT_WIDTH + UNIT_GAP));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
      group.add(mesh);
      posCounter++;
    }

    // Floor slabs (simplified — one for each wing)
    const slabMat = new THREE.MeshStandardMaterial({ color: COLOR_SLAB });

    const slab1 = new THREE.Mesh(new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wingWidth(wings[0]) + 0.3), slabMat.clone());
    slab1.position.set(-(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP), floorY - FLOOR_SLAB_HEIGHT / 2, -(wings[0] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    group.add(slab1);

    const slab2 = new THREE.Mesh(new THREE.BoxGeometry(maxWingWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3), slabMat.clone());
    slab2.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, bottomZ);
    group.add(slab2);

    const slab3 = new THREE.Mesh(new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wingWidth(wings[2]) + 0.3), slabMat.clone());
    slab3.position.set(maxWingWidth / 2 + UNIT_DEPTH / 2 + UNIT_GAP, floorY - FLOOR_SLAB_HEIGHT / 2, -(wings[2] - 1) * (UNIT_WIDTH + UNIT_GAP) / 2);
    group.add(slab3);
  }
}

function buildCourtyardBuilding(
  building: StackingBuilding,
  unitMap: Map<string, RentRollUnit>,
  group: THREE.Group,
) {
  // Resolve per-wing unit counts from wings data or split evenly across 4 wings
  const bwings = building.wings;
  let wingUnits: number[];
  if (bwings && bwings.length >= 4) {
    wingUnits = bwings.slice(0, 4).map((w) => w.units_per_floor);
  } else if (bwings && bwings.length === 3) {
    const used = bwings.reduce((s, w) => s + w.units_per_floor, 0);
    const fourth = Math.max(1, building.units_per_floor - used);
    wingUnits = [...bwings.map((w) => w.units_per_floor), fourth];
  } else {
    const perWing = Math.floor(building.units_per_floor / 4);
    const rem = building.units_per_floor - perWing * 4;
    wingUnits = [
      perWing + (rem > 0 ? 1 : 0),
      perWing + (rem > 1 ? 1 : 0),
      perWing + (rem > 2 ? 1 : 0),
      perWing,
    ];
  }

  const step = UNIT_WIDTH + UNIT_GAP;
  const ww = (n: number) => n * step - UNIT_GAP;

  // Courtyard dimensions — horizontal wings (N/S) set width, vertical wings (E/W) set depth
  const courtyardW = Math.max(ww(wingUnits[0]), ww(wingUnits[2]));
  const courtyardD = Math.max(ww(wingUnits[1]), ww(wingUnits[3]));

  // Wing center positions (centered around origin)
  const northZ = courtyardD / 2 + UNIT_GAP + UNIT_DEPTH / 2;
  const southZ = -(courtyardD / 2 + UNIT_GAP + UNIT_DEPTH / 2);
  const eastX = courtyardW / 2 + UNIT_GAP + UNIT_DEPTH / 2;
  const westX = -(courtyardW / 2 + UNIT_GAP + UNIT_DEPTH / 2);

  for (let floor = 1; floor <= building.num_floors; floor++) {
    const floorY = (floor - 1) * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
    let posCounter = 1;

    // North wing (horizontal, along X)
    const nUnits = wingUnits[0];
    const nWidth = ww(nUnits);
    const slabN = new THREE.Mesh(
      new THREE.BoxGeometry(nWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3),
      new THREE.MeshStandardMaterial({ color: COLOR_SLAB }),
    );
    slabN.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, northZ);
    group.add(slabN);

    for (let i = 0; i < nUnits; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(i * step - nWidth / 2 + UNIT_WIDTH / 2, floorY + UNIT_HEIGHT / 2, northZ);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wing: 'north' } satisfies UnitMeshData;
      group.add(mesh);
      posCounter++;
    }

    // East wing (vertical, along -Z)
    const eUnits = wingUnits[1];
    const eWidth = ww(eUnits);
    const slabE = new THREE.Mesh(
      new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, eWidth + 0.3),
      new THREE.MeshStandardMaterial({ color: COLOR_SLAB }),
    );
    slabE.position.set(eastX, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slabE);

    for (let i = 0; i < eUnits; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(eastX, floorY + UNIT_HEIGHT / 2, -(i * step - eWidth / 2 + UNIT_WIDTH / 2));
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wing: 'east' } satisfies UnitMeshData;
      group.add(mesh);
      posCounter++;
    }

    // South wing (horizontal, along X)
    const sUnits = wingUnits[2];
    const sWidth = ww(sUnits);
    const slabS = new THREE.Mesh(
      new THREE.BoxGeometry(sWidth + 0.3, FLOOR_SLAB_HEIGHT, UNIT_DEPTH + 0.3),
      new THREE.MeshStandardMaterial({ color: COLOR_SLAB }),
    );
    slabS.position.set(0, floorY - FLOOR_SLAB_HEIGHT / 2, southZ);
    group.add(slabS);

    for (let i = 0; i < sUnits; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH);
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(i * step - sWidth / 2 + UNIT_WIDTH / 2, floorY + UNIT_HEIGHT / 2, southZ);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wing: 'south' } satisfies UnitMeshData;
      group.add(mesh);
      posCounter++;
    }

    // West wing (vertical, along +Z)
    const wUnits = wingUnits[3];
    const wWidth = ww(wUnits);
    const slabW = new THREE.Mesh(
      new THREE.BoxGeometry(UNIT_DEPTH + 0.3, FLOOR_SLAB_HEIGHT, wWidth + 0.3),
      new THREE.MeshStandardMaterial({ color: COLOR_SLAB }),
    );
    slabW.position.set(westX, floorY - FLOOR_SLAB_HEIGHT / 2, 0);
    group.add(slabW);

    for (let i = 0; i < wUnits; i++) {
      const key = `${building.id}_${floor}_${posCounter}`;
      const rr = unitMap.get(key);
      const status = getUnitStatus(rr);
      const geom = new THREE.BoxGeometry(UNIT_DEPTH, UNIT_HEIGHT, UNIT_WIDTH);
      const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(westX, floorY + UNIT_HEIGHT / 2, i * step - wWidth / 2 + UNIT_WIDTH / 2);
      mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
      mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr, wing: 'west' } satisfies UnitMeshData;
      group.add(mesh);
      posCounter++;
    }
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
    const slab = new THREE.Mesh(slabGeom, new THREE.MeshStandardMaterial({ color: COLOR_SLAB }));
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
        const mat = new THREE.MeshStandardMaterial({ color: getColorForStatus(status), transparent: true, opacity: 0.88 });
        const mesh = new THREE.Mesh(geom, mat);

        const x = c * (UNIT_WIDTH + UNIT_GAP) - gridWidth / 2 + UNIT_WIDTH / 2;
        const z = r * (UNIT_DEPTH + UNIT_GAP) - gridDepth / 2 + UNIT_DEPTH / 2;
        mesh.position.set(x, floorY + UNIT_HEIGHT / 2, z);
        mesh.name = `unit_${building.id}_${floor}_${posCounter}`;
        mesh.userData = { building_id: building.id, building_label: building.label, floor, position: posCounter, status, rentRollUnit: rr } satisfies UnitMeshData;
        group.add(mesh);
        posCounter++;
      }
    }
  }

  // Roof
  const roofY = building.num_floors * (UNIT_HEIGHT + FLOOR_SLAB_HEIGHT);
  const roofGeom = new THREE.BoxGeometry(gridWidth + 0.3, FLOOR_SLAB_HEIGHT, gridDepth + 0.3);
  const roof = new THREE.Mesh(roofGeom, new THREE.MeshStandardMaterial({ color: COLOR_SLAB }));
  roof.position.set(0, roofY - FLOOR_SLAB_HEIGHT / 2, 0);
  group.add(roof);
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
    const color = isPool ? new THREE.Color(0x38BDF8) : COLOR_AMENITY;
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6 });
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

export function StackingViewer3D({ layout, rentRollUnits, onUnitClick }: StackingViewer3DProps) {
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

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredRef.current?.userData?.building_id) {
      onUnitClick(hoveredRef.current.userData as UnitMeshData);
    }
  }, [onUnitClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1a);
    sceneRef.current = scene;

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000);
    cameraRef.current = camera;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controlsRef.current = controls;

    // ── Lighting ──
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 15, 10);
    scene.add(directional);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 8, -10);
    scene.add(fillLight);

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

    // ── Dynamic ground plane ──
    const sceneBox = new THREE.Box3().setFromObject(scene);
    const sceneSize = new THREE.Vector3();
    sceneBox.getSize(sceneSize);
    const groundSize = Math.max(sceneSize.x, sceneSize.z) + 40;

    const gridHelper = new THREE.GridHelper(groundSize, Math.max(10, Math.floor(groundSize / 2)), 0x2a2a4a, 0x1a1a3a);
    scene.add(gridHelper);
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: COLOR_GROUND, transparent: true, opacity: 0.5 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // ── Camera position ──
    const finalSceneBox = new THREE.Box3().setFromObject(scene);
    const sceneCenter = new THREE.Vector3();
    finalSceneBox.getCenter(sceneCenter);
    const finalSceneSize = new THREE.Vector3();
    finalSceneBox.getSize(finalSceneSize);
    const maxDim = Math.max(finalSceneSize.x, finalSceneSize.y, finalSceneSize.z);

    camera.position.set(sceneCenter.x + maxDim * 0.6, sceneCenter.y + maxDim * 0.8, sceneCenter.z + maxDim * 1.2);
    controls.target.copy(sceneCenter);
    controls.update();

    // ── Animate ──
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Raycasting for hover
      if (cameraRef.current && sceneRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const unitMeshes = sceneRef.current.children.flatMap((child) => {
          if (child instanceof THREE.Group) {
            return child.children.filter(
              (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name.startsWith('unit_'),
            );
          }
          return child instanceof THREE.Mesh && child.name.startsWith('unit_') ? [child] : [];
        });

        const intersects = raycasterRef.current.intersectObjects(unitMeshes);

        // Reset previous hover
        if (hoveredRef.current) {
          const mat = hoveredRef.current.material as THREE.MeshStandardMaterial;
          mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
          hoveredRef.current = null;
        }

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          if (hit.name.startsWith('unit_')) {
            const mat = hit.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(COLOR_HOVER_EMISSIVE);
            mat.emissiveIntensity = 0.4;
            hoveredRef.current = hit;
            container.style.cursor = 'pointer';
          }
        } else {
          container.style.cursor = 'grab';
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    setIsReady(true);

    // ── Event listeners ──
    container.addEventListener('mousemove', handleMouseMove);
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
      container.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [layout, rentRollUnits, handleMouseMove, handleClick]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-2xl overflow-hidden border border-border/60"
        style={{ height: 480 }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
          <p className="text-muted-foreground text-sm">Loading 3D viewer...</p>
        </div>
      )}
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8B5CF6' }} /> Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#F43F5E' }} /> Vacant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6B7280' }} /> No Data
        </span>
        <span className="text-muted-foreground/60 ml-auto">Click a unit for details · Drag to rotate</span>
      </div>
    </div>
  );
}
