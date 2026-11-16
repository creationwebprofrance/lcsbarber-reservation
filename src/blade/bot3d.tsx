// Mascotte 3D de l'assistant BLADE (Three.js / React Three Fiber).
// Reprend le bot existant : tête crème, crête en peigne de barbier, visière brune aux yeux
// lumineux, écouteurs cerclés de bronze, épingle de localisation sur le torse.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CREAM = '#efe4d6';
const BRONZE = '#a8743f';
const VISOR = '#3b2116';
const GLOW = '#f2c99b';

export type BotMood = 'idle' | 'wave' | 'thinking';

// Position du pointeur partagée (−1..1), mise à jour une seule fois pour toutes les mascottes.
const pointer = { x: 0, y: 0 };
let listening = false;
function listenPointer() {
  if (listening || typeof window === 'undefined') return; listening = true;
  window.addEventListener('pointermove', e => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = (e.clientY / window.innerHeight) * 2 - 1; }, { passive: true });
}

function Smile() {
  const geo = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 0.16, 0.1, Math.PI * 1.15, Math.PI * 1.85, false, 0);
    const pts = curve.getPoints(24).map(p => new THREE.Vector3(p.x, p.y, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 8, false);
  }, []);
  return <mesh geometry={geo} position={[0, -0.02, 0.005]}><meshStandardMaterial color={GLOW} emissive={GLOW} emissiveIntensity={1.6} toneMapped={false} /></mesh>;
}

function Bot({ mood }: { mood: BotMood }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const eyeMat = useRef<THREE.MeshStandardMaterial>(null);
  const blinkAt = useRef(1.5);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = Math.min(1, dt * 6);
    if (root.current) root.current.position.y = Math.sin(t * 1.6) * 0.05;
    if (head.current) {
      const thinking = mood === 'thinking';
      const ty = thinking ? Math.sin(t * 1.2) * 0.35 : pointer.x * 0.55;
      const tx = thinking ? -0.12 : pointer.y * 0.3;
      const tz = thinking ? 0.18 : 0;
      head.current.rotation.y += (ty - head.current.rotation.y) * k;
      head.current.rotation.x += (tx - head.current.rotation.x) * k;
      head.current.rotation.z += (tz - head.current.rotation.z) * k;
    }
    // Clignement des yeux toutes les 3 à 5 secondes.
    if (eyes.current) {
      if (t > blinkAt.current) blinkAt.current = t + 3 + Math.random() * 2;
      const d = blinkAt.current - t;
      const closed = d > 0 && d < 0.12 ? 0.12 : 1;
      eyes.current.scale.y += (closed - eyes.current.scale.y) * Math.min(1, dt * 30);
    }
    if (eyeMat.current) eyeMat.current.emissiveIntensity = mood === 'thinking' ? 1.4 + Math.sin(t * 6) * 0.8 : 1.8;
    // Coucou : le bras se lève et s'agite.
    if (arm.current) {
      const target = mood === 'wave' ? 2.4 + Math.sin(t * 9) * 0.35 : 0.35;
      arm.current.rotation.z += (target - arm.current.rotation.z) * Math.min(1, dt * 8);
    }
  });

  const teeth = [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3];
  return <group ref={root} position={[0, -0.12, 0]}>
    {/* Corps */}
    <mesh position={[0, -0.78, 0]}><capsuleGeometry args={[0.36, 0.28, 8, 24]} /><meshStandardMaterial color={CREAM} roughness={0.35} metalness={0.15} /></mesh>
    <mesh position={[0, -0.47, 0]}><cylinderGeometry args={[0.13, 0.16, 0.14, 24]} /><meshStandardMaterial color={BRONZE} roughness={0.3} metalness={0.7} /></mesh>
    {/* Épingle de localisation sur le torse */}
    <group position={[0, -0.72, 0.36]} scale={0.9}>
      <mesh position={[0, 0.05, 0]}><sphereGeometry args={[0.07, 20, 20]} /><meshStandardMaterial color={BRONZE} metalness={0.7} roughness={0.25} /></mesh>
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.055, 0.12, 20]} /><meshStandardMaterial color={BRONZE} metalness={0.7} roughness={0.25} /></mesh>
    </group>
    {/* Bras gauche (repos) et bras droit (coucou) */}
    <mesh position={[-0.46, -0.78, 0]} rotation={[0, 0, -0.35]}><capsuleGeometry args={[0.08, 0.3, 6, 16]} /><meshStandardMaterial color={CREAM} roughness={0.35} /></mesh>
    <group ref={arm} position={[0.4, -0.6, 0]} rotation={[0, 0, 0.35]}>
      <mesh position={[0, -0.2, 0]}><capsuleGeometry args={[0.08, 0.3, 6, 16]} /><meshStandardMaterial color={CREAM} roughness={0.35} /></mesh>
      <mesh position={[0, -0.42, 0]}><sphereGeometry args={[0.1, 16, 16]} /><meshStandardMaterial color={CREAM} roughness={0.35} /></mesh>
    </group>
    {/* Tête : casque arrondi */}
    <group ref={head} position={[0, 0.05, 0]}>
      <mesh scale={[1, 0.88, 0.86]}><sphereGeometry args={[0.56, 48, 40]} /><meshStandardMaterial color={CREAM} roughness={0.3} metalness={0.12} /></mesh>
      {/* Visière bombée */}
      <mesh scale={[1.015, 0.895, 0.875]}><sphereGeometry args={[0.56, 48, 32, Math.PI / 2 - 0.82, 1.64, Math.PI / 2 - 0.52, 1.0]} /><meshPhysicalMaterial color={VISOR} emissive="#4a2516" emissiveIntensity={0.35} roughness={0.12} metalness={0.2} clearcoat={1} clearcoatRoughness={0.06} side={THREE.DoubleSide} /></mesh>
      <group position={[0, -0.02, 0.49]}>
        <group ref={eyes}>
          {[-0.19, 0.19].map(x => <mesh key={x} position={[x, 0.07, -Math.abs(x) * 0.1]} rotation={[0, x * 1.4, 0]} scale={[1, 1.3, 1]}><circleGeometry args={[0.08, 32]} /><meshStandardMaterial ref={x < 0 ? eyeMat : undefined} color={GLOW} emissive={GLOW} emissiveIntensity={1.8} toneMapped={false} /></mesh>)}
        </group>
        <Smile />
      </group>
      {/* Écouteurs */}
      {[-1, 1].map(s => <group key={s} position={[s * 0.55, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh><cylinderGeometry args={[0.16, 0.16, 0.12, 32]} /><meshStandardMaterial color={CREAM} roughness={0.3} /></mesh>
        <mesh position={[0, s * 0.065, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.026, 12, 32]} /><meshStandardMaterial color={BRONZE} metalness={0.75} roughness={0.25} emissive={BRONZE} emissiveIntensity={0.3} /></mesh>
      </group>)}
      {/* Crête : peigne de barbier, la première dent recourbée vers l’avant */}
      <group position={[0, 0.44, -0.02]} rotation={[-0.35, 0, 0]}>
        {teeth.map((x, i) => <mesh key={x} position={[x * 0.85, 0.07 + (i === 0 ? 0.05 : 0), 0]} rotation={[0, 0, i === 0 ? 0.45 : -0.04 * i]}>
          <capsuleGeometry args={[0.042, i === 0 ? 0.24 : 0.14, 6, 12]} />
          <meshStandardMaterial color={i % 2 ? BRONZE : CREAM} metalness={i % 2 ? 0.6 : 0.1} roughness={0.3} />
        </mesh>)}
      </group>
    </group>
  </group>;
}

/** Mascotte 3D sur fond transparent. Arrête de dessiner quand l'onglet est caché. */
export default function Bot3D({ mood = 'idle', className }: { mood?: BotMood; className?: string }) {
  useEffect(listenPointer, []);
  return <Canvas className={className} dpr={[1, 2]} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} camera={{ position: [0, 0.05, 3.9], fov: 32 }} aria-hidden="true">
    <ambientLight intensity={0.55} />
    <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
    <directionalLight position={[-3, 1, -2]} intensity={0.9} color="#ffd9b0" />
    <pointLight position={[0, -1.5, 2]} intensity={0.6} color="#ffe7cc" />
    <Bot mood={mood} />
  </Canvas>;
}
