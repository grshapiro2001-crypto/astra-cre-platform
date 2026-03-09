import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

interface TalismanCompass3DProps {
  size?: number;
  spin?: boolean;
  speed?: number;
  className?: string;
}

const TalismanCompass3D = ({ size = 200, spin = true, speed = 1.25, className }: TalismanCompass3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const hoverRef = useRef(false);

  const buildScene = useCallback((container: HTMLDivElement) => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    // ── MATERIALS ──
    const gunmetalBright = new THREE.MeshPhysicalMaterial({
      color: 0x606070, metalness: 0.95, roughness: 0.2,
      clearcoat: 0.85, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    });
    const gunmetalDark = new THREE.MeshPhysicalMaterial({
      color: 0x2e2e3c, metalness: 0.96, roughness: 0.28,
      clearcoat: 0.5, clearcoatRoughness: 0.15,
      transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });
    const gunmetalMid = new THREE.MeshPhysicalMaterial({
      color: 0x444456, metalness: 0.94, roughness: 0.22,
      clearcoat: 0.7, clearcoatRoughness: 0.1,
      transparent: true, opacity: 0.72, side: THREE.DoubleSide,
    });
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x404050, metalness: 0.96, roughness: 0.2,
      clearcoat: 0.6, clearcoatRoughness: 0.1,
      transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });
    const chainMat = new THREE.MeshPhysicalMaterial({
      color: 0x4a4a5c, metalness: 0.88, roughness: 0.35,
      clearcoat: 0.3, clearcoatRoughness: 0.25,
      transparent: true, opacity: 0.075,
    });

    // ── COMPASS GROUP ──
    const compassGroup = new THREE.Group();
    scene.add(compassGroup);

    // Ring
    const mainRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 32, 120), ringMat);
    compassGroup.add(mainRing);
    compassGroup.add(new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.082, 20, 100),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.03 })
    ));

    // ── COMPASS STAR ──
    function makePoint(length: number, midWidth: number, depth: number, mat: THREE.Material) {
      const shape = new THREE.Shape();
      shape.moveTo(0, length);
      shape.lineTo(midWidth, length * 0.35);
      shape.lineTo(midWidth * 0.4, length * 0.05);
      shape.lineTo(0, 0);
      shape.lineTo(-midWidth * 0.4, length * 0.05);
      shape.lineTo(-midWidth, length * 0.35);
      shape.closePath();
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelThickness: 0.025,
        bevelSize: 0.02, bevelSegments: 5,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.z = -depth / 2;
      return mesh;
    }

    // 4 Cardinal needles
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const len = i % 2 === 0 ? 2.05 : 1.85;
      const bright = makePoint(len, 0.12, 0.05, gunmetalBright);
      bright.rotation.z = a;
      bright.position.z += 0.01;
      compassGroup.add(bright);
      const dark = makePoint(len, 0.12, 0.05, gunmetalDark);
      dark.rotation.z = a;
      dark.rotation.y = Math.PI;
      dark.position.z -= 0.01;
      compassGroup.add(dark);
    }

    // 4 Intercardinal points
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const mid = makePoint(1.28, 0.2, 0.04, gunmetalMid);
      mid.rotation.z = a;
      compassGroup.add(mid);
      const dk = makePoint(1.28, 0.2, 0.04, gunmetalDark);
      dk.rotation.z = a;
      dk.rotation.y = Math.PI;
      compassGroup.add(dk);
    }

    // Center hub
    const hub1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 32), ringMat);
    hub1.rotation.x = Math.PI / 2;
    compassGroup.add(hub1);
    const hub2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 32), gunmetalDark);
    hub2.rotation.x = Math.PI / 2;
    compassGroup.add(hub2);

    // ── CHAINS — 4 strands at 45° intervals ──
    const linkLen = 0.065, linkWid = 0.024, linkWire = 0.011;
    const ovalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -linkLen, 0),
      new THREE.Vector3(linkWid, -linkLen * 0.35, 0),
      new THREE.Vector3(linkWid, linkLen * 0.35, 0),
      new THREE.Vector3(0, linkLen, 0),
      new THREE.Vector3(-linkWid, linkLen * 0.35, 0),
      new THREE.Vector3(-linkWid, -linkLen * 0.35, 0),
      new THREE.Vector3(0, -linkLen, 0),
    ], false);
    const linkGeom = new THREE.TubeGeometry(ovalCurve, 14, linkWire, 6, false);

    const strands: { links: THREE.Mesh[]; cfg: typeof strandConfigs[0] }[] = [];
    const linksPerStrand = 55;
    const strandConfigs = [
      { tiltZ: 0.0, dir: 1, speedMult: 1.0, radius: 2.2 },
      { tiltZ: Math.PI * 0.25, dir: -1, speedMult: 0.9, radius: 2.15 },
      { tiltZ: Math.PI * 0.5, dir: 1, speedMult: 0.8, radius: 2.25 },
      { tiltZ: Math.PI * 0.75, dir: -1, speedMult: 0.7, radius: 2.18 },
    ];

    strandConfigs.forEach((cfg) => {
      const strandGroup = new THREE.Group();
      strandGroup.rotation.order = "ZXY";
      strandGroup.rotation.z = cfg.tiltZ;
      strandGroup.rotation.x = Math.PI / 2;
      scene.add(strandGroup);
      const links: THREE.Mesh[] = [];
      for (let i = 0; i < linksPerStrand; i++) {
        const link = new THREE.Mesh(linkGeom, chainMat);
        links.push(link);
        strandGroup.add(link);
      }
      strands.push({ links, cfg });
    });

    // ── LIGHTING ──
    scene.add(new THREE.AmbientLight(0x505068, 0.8));
    const keyLight = new THREE.PointLight(0xffffff, 2.0, 25);
    keyLight.position.set(3, 4, 6);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x8888bb, 0.7, 18);
    fillLight.position.set(-4, 1, 4);
    scene.add(fillLight);
    scene.add((() => { const l = new THREE.PointLight(0x9966cc, 0.5, 15); l.position.set(0, -3, 5); return l; })());
    scene.add((() => { const l = new THREE.PointLight(0x556688, 0.4, 12); l.position.set(2, -1, -5); return l; })());
    scene.add((() => { const l = new THREE.PointLight(0xffffff, 0.8, 20); l.position.set(0, 5, 3); return l; })());

    // ── ANIMATION ──
    const clock = new THREE.Clock();
    const _tmpVec = new THREE.Vector3();

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = speed;

      if (spin) {
        compassGroup.rotation.y = t * s * 0.35;
        compassGroup.rotation.x = Math.sin(t * s * 0.08) * 0.04;
      }

      strands.forEach(({ links, cfg }) => {
        const baseAngle = t * s * 0.12 * cfg.dir * cfg.speedMult;
        const r = cfg.radius;
        const n = links.length;
        for (let i = 0; i < n; i++) {
          const frac = i / n;
          const arcSpan = Math.PI * 1.5;
          const angle = baseAngle + frac * arcSpan;
          const localR = r + Math.sin(frac * Math.PI * 3 + t * 0.5) * 0.05;
          const z = Math.sin(angle * 1.5 + frac * Math.PI) * 0.12;
          const x = Math.cos(angle) * localR;
          const y = Math.sin(angle) * localR;
          links[i].position.set(x, y, z);

          const nextAngle = angle + 0.05;
          const nextR = r + Math.sin(((i + 1) / n) * Math.PI * 3 + t * 0.5) * 0.05;
          const nextZ = Math.sin(nextAngle * 1.5 + ((i + 1) / n) * Math.PI) * 0.12;
          _tmpVec.set(
            Math.cos(nextAngle) * nextR - x,
            Math.sin(nextAngle) * nextR - y,
            nextZ - z
          ).normalize();

          const tangent = _tmpVec;
          const worldUp = new THREE.Vector3(0, 0, 1);
          const right = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
          if (right.lengthSq() < 0.001) right.set(1, 0, 0);
          const up = new THREE.Vector3().crossVectors(right, tangent).normalize();
          const mat4 = new THREE.Matrix4().makeBasis(right, tangent, up);
          links[i].setRotationFromMatrix(mat4);
          if (i % 2 === 0) links[i].rotateY(Math.PI / 2);

          const tailFade = i > n - 6 ? (n - i) / 6 : 1;
          const headFade = i < 4 ? (i + 1) / 4 : 1;
          links[i].scale.setScalar(Math.min(tailFade, headFade));
        }
      });

      const targetZ = hoverRef.current ? 6.5 : 8;
      camera.position.z += (targetZ - camera.position.z) * 0.04;
      keyLight.position.x = 3 + Math.sin(t * 0.35) * 0.5;
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [size, spin, speed]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    return buildScene(container);
  }, [buildScene]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: size, height: size, cursor: "pointer" }}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    />
  );
};

export default TalismanCompass3D;
