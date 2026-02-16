import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

function BarberPoleStripes() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;

    // White base
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 512, 1024);

    // Draw diagonal stripes
    const stripeWidth = 80;
    const colors = ["#FF4433", "#FFFFFF", "#0099FF", "#FFFFFF"];

    for (let i = -20; i < 40; i++) {
      const colorIndex = ((i % colors.length) + colors.length) % colors.length;
      ctx.fillStyle = colors[colorIndex];
      ctx.beginPath();
      const x = i * stripeWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - 600, 1024);
      ctx.lineTo(x - 600, 1024);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  return texture;
}

function Pole() {
  const groupRef = useRef<THREE.Group>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [hovered, setHovered] = useState(false);
  const stripeTexture = BarberPoleStripes();

  textureRef.current = stripeTexture;

  useFrame((_, delta) => {
    if (textureRef.current) {
      const speed = hovered ? 0.6 : 0.25;
      textureRef.current.offset.y += delta * speed;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 0.4 : 0.15);
    }
  });

  const capMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#C0C0C0",
        metalness: 0.95,
        roughness: 0.1,
      }),
    []
  );

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        metalness: 0.5,
        roughness: 0.3,
      }),
    []
  );

  return (
    <group
      ref={groupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
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
    <div className="w-full h-[240px] sm:h-[400px] md:h-[450px] cursor-grab active:cursor-grabbing">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 5]} intensity={1.2} />
        <directionalLight position={[-3, -2, 3]} intensity={0.4} />
        <pointLight position={[0, 3, 2]} intensity={0.5} color="#0099FF" />
        <pointLight position={[0, -3, 2]} intensity={0.3} color="#FF4433" />
        <Suspense fallback={null}>
          <Pole />
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
    </div>
  );
}
