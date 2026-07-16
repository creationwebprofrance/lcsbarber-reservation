import { useRef, useState, useMemo, Suspense, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

function useBarberTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    // Use a square canvas for perfect tiling
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Cream base
    ctx.fillStyle = "#F4F1EA";
    ctx.fillRect(0, 0, size, size);

    // Draw diagonal stripes that tile perfectly
    // The key: stripes must connect at top and bottom edges
    const stripeWidth = 60;
    const colors = ["#0B0B0B", "#F4F1EA", "#C58B52", "#F4F1EA"];
    const patternWidth = stripeWidth * colors.length; // 240
    // shift must be exact multiple of patternWidth for seamless tiling
    const shift = patternWidth * 2; // 480
    const numStripes = 30;

    for (let i = -numStripes; i < numStripes; i++) {
      const colorIndex = ((i % colors.length) + colors.length) % colors.length;
      ctx.fillStyle = colors[colorIndex];
      ctx.beginPath();
      const x = i * stripeWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - shift, size);
      ctx.lineTo(x - shift, size);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function Pole() {
  const groupRef = useRef<THREE.Group>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const stripeTexture = useBarberTexture();

  textureRef.current = stripeTexture;

  useFrame((_, delta) => {
    if (textureRef.current) {
      const speed = pressed ? 1.2 : hovered ? 0.6 : 0.25;
      textureRef.current.offset.y += delta * speed;
    }
    if (groupRef.current) {
      const targetRotSpeed = pressed ? 0.8 : hovered ? 0.4 : 0.15;
      groupRef.current.rotation.y += delta * targetRotSpeed;
    }
  });

  const handlePointerOver = useCallback(() => setHovered(true), []);
  const handlePointerOut = useCallback(() => {
    setHovered(false);
    setPressed(false);
  }, []);
  const handlePointerDown = useCallback(() => setPressed(true), []);
  const handlePointerUp = useCallback(() => setPressed(false), []);

  const capMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#C58B52",
        metalness: 0.9,
        roughness: 0.25,
      }),
    []
  );

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0B0B0B",
        metalness: 0.6,
        roughness: 0.35,
      }),
    []
  );

  return (
    <group
      ref={groupRef}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Main cylinder with stripes */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 3, 32]} />
        <meshStandardMaterial
          map={stripeTexture}
          metalness={0.15}
          roughness={0.4}
        />
      </mesh>

      {/* Glass outer cylinder */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 2.9, 32]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.12}
          roughness={0.05}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Top cap */}
      <mesh position={[0, 1.6, 0]} material={capMaterial}>
        <cylinderGeometry args={[0.42, 0.42, 0.15, 32]} />
      </mesh>
      <mesh position={[0, 1.72, 0]} material={capMaterial}>
        <sphereGeometry args={[0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* Bottom cap */}
      <mesh position={[0, -1.6, 0]} material={capMaterial}>
        <cylinderGeometry args={[0.42, 0.42, 0.15, 32]} />
      </mesh>
      <mesh
        position={[0, -1.72, 0]}
        rotation={[Math.PI, 0, 0]}
        material={capMaterial}
      >
        <sphereGeometry args={[0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* Base / mount */}
      <mesh position={[0, -2.0, 0]} material={baseMaterial}>
        <cylinderGeometry args={[0.2, 0.3, 0.5, 16]} />
      </mesh>
      <mesh position={[0, -2.3, 0]} material={baseMaterial}>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 16]} />
      </mesh>
    </group>
  );
}

export default function BarberPole3D() {
  return (
    <div className="w-full h-[240px] sm:h-[400px] md:h-[450px] cursor-grab active:cursor-grabbing touch-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 5]} intensity={1.2} />
        <directionalLight position={[-3, -2, 3]} intensity={0.4} />
        <pointLight position={[0, 3, 2]} intensity={0.6} color="#C58B52" />
        <pointLight position={[0, -3, 2]} intensity={0.3} color="#F4F1EA" />
        <Suspense fallback={null}>
          <Pole />
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
    </div>
  );
}
