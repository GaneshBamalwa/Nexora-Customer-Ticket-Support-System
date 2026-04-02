import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, Float } from '@react-three/drei'
import * as THREE from 'three'

interface EnergyOrbProps {
  mouse: React.MutableRefObject<[number, number]>;
  variant: string;
  opacity?: number;
}

function EnergyOrb({ mouse, variant, opacity = 1 }: EnergyOrbProps) {
  const mesh = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const { clock } = state
    const t = clock.getElapsedTime()
    mesh.current.rotation.x = -mouse.current[1] * 0.3
    mesh.current.rotation.y = mouse.current[0] * 0.3
    mesh.current.position.y = Math.sin(t * 0.5) * 0.2
  })

  const orbColor = useMemo(() => {
    if (variant === 'login') return "#b537f2" // Violet for login
    if (variant === 'analytics') return "#00d4ff" // Deeper cyan for analytics
    return "#00e5ff" // Default cyan
  }, [variant])

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <Sphere ref={mesh} args={[1.2, 128, 128]}>
        <MeshDistortMaterial
          color={orbColor}
          speed={3}
          distort={0.4}
          radius={1}
          metalness={0.8}
          roughness={0.1}
          emissive={variant === 'login' ? "#7c3aed" : "#00d4ff"}
          emissiveIntensity={0.4 * opacity}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </Sphere>
    </Float>
  )
}

function Particles({ count = 150, mouse, variant }: { count: number; mouse: React.MutableRefObject<[number, number]>; variant: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100
      const factor = 10 + Math.random() * 50
      const speed = variant === 'architects' ? 0.001 + Math.random() / 1000 : 0.005 + Math.random() / 500
      const xFactor = -30 + Math.random() * 60
      const yFactor = -30 + Math.random() * 60
      const zFactor = -30 + Math.random() * 60
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor })
    }
    return temp
  }, [count, variant])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle
      t = particle.t += speed / 3
      const a = Math.cos(t) + Math.sin(t * 1) / 5
      const b = Math.sin(t) + Math.cos(t * 2) / 5
      const s = Math.cos(t)
      
      // Add cursor interaction - subtle drift
      const mx = mouse.current[0] * 2
      const my = -mouse.current[1] * 2

      dummy.position.set(
        (xFactor + Math.cos(t / 10) * factor + (a * 5)) / 10 + mx,
        (yFactor + Math.sin(t / 10) * factor + (b * 5)) / 10 + my,
        (zFactor + Math.cos(t / 10) * factor + (s * 5)) / 10
      )
      dummy.scale.set(s * 0.4, s * 0.4, s * 0.4)
      dummy.rotation.set(s * 5, s * 5, s * 5)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null as any, null as any, count]}>
      <sphereGeometry args={[0.02, 16, 16]} />
      <meshStandardMaterial 
        color={variant === 'architects' ? "#ffffff" : "#00e5ff"} 
        emissive={variant === 'architects' ? "#ffffff" : "#00e5ff"} 
        emissiveIntensity={variant === 'architects' ? 0.5 : 1} 
        transparent 
        opacity={0.4} 
      />
    </instancedMesh>
  )
}

interface ImmersiveBackgroundProps {
  variant?: string;
  intensity?: 'light' | 'medium' | 'heavy';
  showOrb?: boolean;
  orbOpacity?: number;
}

export const ImmersiveBackground = ({ 
  variant = 'landing', 
  intensity = 'medium', 
  showOrb = true,
  orbOpacity = 1
}: ImmersiveBackgroundProps) => {
  const mouse = useRef<[number, number]>([0, 0])
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      ]
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const particleCount = useMemo(() => {
    const counts = { light: 50, medium: 150, heavy: 300 }
    return counts[intensity]
  }, [intensity])

  return (
    <div 
        className="fixed inset-0 z-0 pointer-events-none" 
        style={{ 
            background: '#020818',
            perspective: '1000px'
        }}
    >
      {/* Animated Grid Layer */}
      <div 
        className="absolute inset-0 opacity-[0.03] grid-bg-animated"
        style={{ transform: `translateY(${scrollY * 0.05}px)` }}
      />

      {/* Three.js Experience Layer */}
      <Canvas 
        camera={{ position: [0, 0, 7], fov: 60 }} 
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00e5ff" />
        <spotLight 
            position={[-10, 10, 15]} 
            angle={0.25} 
            penumbra={1} 
            intensity={1.5 * orbOpacity} 
            color={variant === 'login' ? '#b537f2' : '#00e5ff'} 
        />
        
        {showOrb && variant !== 'architects' && (
          <EnergyOrb mouse={mouse} variant={variant} opacity={orbOpacity} />
        )}
        <Particles count={particleCount} mouse={mouse} variant={variant} />

        {/* Depth Fog */}
        <fog attach="fog" args={['#020818', 5, 20]} />
      </Canvas>

      {/* Decorative Glow Overlays */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
            background: `radial-gradient(circle at ${50 + mouse.current[0] * 50}% ${50 + mouse.current[1] * 50}%, rgba(0, 229, 255, 0.1) 0%, transparent 70%)`
        }}
      />
    </div>
  )
}
