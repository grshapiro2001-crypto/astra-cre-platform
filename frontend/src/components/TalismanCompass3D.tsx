import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

interface TalismanCompass3DProps {
  size?: number;
  spin?: boolean;
  speed?: number;
}

const TalismanCompass3D = ({ size = 500, spin = true, speed = 1.0 }: TalismanCompass3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const hoverRef = useRef(false);

  const buildScene = useCallback((container: HTMLDivElement) => {
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = size <= 64 ? 2.4 : size <= 120 ? 2.0 : 1.6;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    // ═══════════════════════════════════════
    // MATERIALS — Silver Metallic
    // ═══════════════════════════════════════

    const gunmetalBright = new THREE.MeshPhysicalMaterial({
      color: 0xC0C0C0, metalness: 0.95, roughness: 0.2,
      clearcoat: 0.85, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    });

    const gunmetalDark = new THREE.MeshPhysicalMaterial({
      color: 0x888888, metalness: 0.96, roughness: 0.28,
      clearcoat: 0.5, clearcoatRoughness: 0.15,
      transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });

    const gunmetalMid = new THREE.MeshPhysicalMaterial({
      color: 0xA0A0A0, metalness: 0.94, roughness: 0.22,
      clearcoat: 0.7, clearcoatRoughness: 0.1,
      transparent: true, opacity: 0.82, side: THREE.DoubleSide,
    });

    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x999999, metalness: 0.96, roughness: 0.2,
      clearcoat: 0.6, clearcoatRoughness: 0.1,
      transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    });

    // At small sizes, PBR reflections don't register — add emissive self-glow
    // so the compass reads as silver instead of a dark blob
    const emissiveBoost = size <= 64 ? 0.35 : size <= 120 ? 0.15 : 0.0;
    if (emissiveBoost > 0) {
      const emissiveColor = new THREE.Color(0xC0C0C0);
      [gunmetalBright, gunmetalDark, gunmetalMid, ringMat].forEach(mat => {
        mat.emissive = emissiveColor;
        mat.emissiveIntensity = emissiveBoost;
      });
    }

    if (size <= 64) {
      [gunmetalBright, gunmetalDark, gunmetalMid, ringMat].forEach(mat => {
        mat.opacity = Math.min(mat.opacity + 0.15, 1.0);
      });
    }

    // ═══════════════════════════════════════
    // COMPASS GROUP
    // ═══════════════════════════════════════

    const compassGroup = new THREE.Group();
    scene.add(compassGroup);

    // ── THE RING ──
    const mainRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.1, 32, 120),
      ringMat
    );
    compassGroup.add(mainRing);

    // Inner edge highlight
    compassGroup.add(new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.082, 20, 100),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 })
    ));

    // ── CRYSTAL COMPASS POINTS ──
    // Diamond cross-section with sharp ridgeline — faceted gem look

    function makeCrystalPoint(length: number, halfWidth: number, ridgeHeight: number, mat: THREE.Material) {
      const shoulderY = length * 0.35;
      const taperY = length * 0.06;
      const rh = ridgeHeight;
      const hw = halfWidth;

      const vertices = new Float32Array([
        // 0: tip
        0, length, 0,
        // 1-4: shoulder diamond (wide point)
        hw,  shoulderY, 0,
        0,   shoulderY, rh,
        -hw, shoulderY, 0,
        0,   shoulderY, -rh,
        // 5-8: taper diamond (near base)
        hw * 0.35,  taperY, 0,
        0,          taperY, rh * 0.5,
        -hw * 0.35, taperY, 0,
        0,          taperY, -rh * 0.5,
        // 9: base
        0, 0, 0,
      ]);

      const indices = [
        // Tip to shoulder (4 faces)
        0, 1, 2,
        0, 2, 3,
        0, 3, 4,
        0, 4, 1,
        // Shoulder to taper (8 faces)
        1, 5, 2,  2, 5, 6,
        2, 6, 3,  3, 6, 7,
        3, 7, 4,  4, 7, 8,
        4, 8, 1,  1, 8, 5,
        // Taper to base (4 faces)
        5, 9, 6,
        6, 9, 7,
        7, 9, 8,
        8, 9, 5,
      ];

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();
      return new THREE.Mesh(geom, mat);
    }

    // 4 CARDINAL — long crystal needles piercing beyond ring
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const isNS = i % 2 === 0;
      const len = isNS ? 2.05 : 1.85;

      const front = makeCrystalPoint(len, 0.13, 0.08, gunmetalBright);
      front.rotation.z = a;
      compassGroup.add(front);

      const back = makeCrystalPoint(len, 0.13, 0.08, gunmetalDark);
      back.rotation.z = a;
      back.rotation.y = Math.PI;
      compassGroup.add(back);
    }

    // 4 INTERCARDINAL — shorter, wider crystal diamonds within ring
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;

      const front = makeCrystalPoint(1.28, 0.2, 0.1, gunmetalMid);
      front.rotation.z = a;
      compassGroup.add(front);

      const back = makeCrystalPoint(1.28, 0.2, 0.1, gunmetalDark);
      back.rotation.z = a;
      back.rotation.y = Math.PI;
      compassGroup.add(back);
    }

    // ── CENTER HUB — faceted gem ──
    const hub1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 4),
      ringMat
    );
    hub1.rotation.x = Math.PI / 4;
    compassGroup.add(hub1);

    const hub2 = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1, 0),
      gunmetalBright
    );
    compassGroup.add(hub2);

    // ═══════════════════════════════════════
    // LIGHTING — cool silver tint
    // ═══════════════════════════════════════

    scene.add(new THREE.AmbientLight(0x484850, 0.8));

    const keyLight = new THREE.PointLight(0xeeeeff, 1.2, 20);
    keyLight.position.set(3, 4, 6);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xaaaacc, 0.7, 18);
    fillLight.position.set(-4, 1, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xbbbbdd, 0.5, 15);
    rimLight.position.set(0, -3, 5);
    scene.add(rimLight);

    const backLight = new THREE.PointLight(0x556688, 0.4, 12);
    backLight.position.set(2, -1, -5);
    scene.add(backLight);

    const topLight = new THREE.PointLight(0xffffff, 0.8, 20);
    topLight.position.set(0, 5, 3);
    scene.add(topLight);

    // ═══════════════════════════════════════
    // ANIMATION
    // ═══════════════════════════════════════

    const clock = new THREE.Clock();

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = speed;

      // Compass: slow majestic Y-spin with subtle X breathing
      if (spin) {
        compassGroup.rotation.y = t * s * 0.35;
        compassGroup.rotation.x = Math.sin(t * s * 0.08) * 0.04;
      }

      // Camera hover zoom
      const targetZ = hoverRef.current ? 6.5 : 8;
      camera.position.z += (targetZ - camera.position.z) * 0.04;

      // Subtle light drift
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
      style={{ width: size, height: size, cursor: "pointer" }}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    />
  );
};

export default TalismanCompass3D;
