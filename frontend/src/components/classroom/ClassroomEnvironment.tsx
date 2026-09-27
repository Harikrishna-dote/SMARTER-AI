// Virtual classroom environment for the AI Teacher Avatar.

import { useMemo } from 'react';
import * as THREE from 'three';

interface ClassroomEnvironmentProps {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fullscreen?: boolean;
  whiteboardContent?: string;
}

export function ClassroomEnvironment({ quality, fullscreen = false, whiteboardContent }: ClassroomEnvironmentProps) {
  const wallHeight = fullscreen ? 6 : 4;
  const showDetails = quality !== 'low';
  const showUltra = quality === 'ultra';

  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
      <pointLight position={[-3, 4, -3]} intensity={0.5} color="#ffeedd" />
      <pointLight position={[3, 3, 2]} intensity={0.3} color="#e0f2fe" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
      </mesh>

      <mesh position={[0, wallHeight / 2, -5]} receiveShadow>
        <boxGeometry args={[20, wallHeight, 0.3]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0.0} />
      </mesh>

      <mesh position={[-10, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[20, wallHeight, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} metalness={0.0} />
      </mesh>
      <mesh position={[10, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[20, wallHeight, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} metalness={0.0} />
      </mesh>

      <mesh position={[0, wallHeight / 2, 5]} rotation={[0, Math.PI, 0]} receiveShadow>
        <boxGeometry args={[20, wallHeight, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} metalness={0.0} />
      </mesh>

      <mesh position={[0, 1.5, -4.9]} receiveShadow>
        <boxGeometry args={[6, 3, 0.05]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
      </mesh>

      <mesh position={[0, 1.5, -4.85]} receiveShadow>
        <boxGeometry args={[5.8, 2.8, 0.02]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.05} />
      </mesh>

      <mesh position={[0, 0.05, -4.8]} receiveShadow>
        <boxGeometry args={[7, 0.1, 0.3]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh position={[0, 0.15, -4.7]} receiveShadow>
        <capsuleGeometry args={[0.05, 0.1, 4, 8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.5} emissive="#ef4444" emissiveIntensity={0.3} />
      </mesh>

      <mesh position={[-2.5, 0.08, -4.7]} receiveShadow>
        <capsuleGeometry args={[0.04, 0.08, 4, 8]} />
        <meshStandardMaterial color="#22c55e" roughness={0.3} metalness={0.5} emissive="#22c55e" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[2.5, 0.08, -4.7]} receiveShadow>
        <capsuleGeometry args={[0.04, 0.08, 4, 8]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.5} emissive="#3b82f6" emissiveIntensity={0.2} />
      </mesh>

      {showDetails && (
        <>
          <mesh position={[-2.5, 1.5, -4.85]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.08, 0.6, 0.02]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.5} metalness={0.3} emissive="#38bdf8" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[2.5, 1.5, -4.85]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.08, 0.6, 0.02]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.5} metalness={0.3} emissive="#f59e0b" emissiveIntensity={0.4} />
          </mesh>
        </>
      )}

      <mesh position={[8, 0.75, 3]} receiveShadow>
        <boxGeometry args={[1.5, 1.5, 0.8]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.3} metalness={0.4} emissive="#38bdf8" emissiveIntensity={0.2} />
      </mesh>

      {showDetails && (
        <mesh position={[-8, 0.75, 3]} receiveShadow>
          <boxGeometry args={[1.5, 1.5, 0.8]} />
          <meshStandardMaterial color="#22c55e" roughness={0.3} metalness={0.4} emissive="#22c55e" emissiveIntensity={0.2} />
        </mesh>
      )}

      {showUltra && (
        <>
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 8, 8]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[-3, 3.5, -3]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[3, 3.5, -3]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.3} />
          </mesh>
        </>
      )}

      {whiteboardContent && showDetails && (
        <mesh position={[0, 1.5, -4.82]}>
          <planeGeometry args={[5.6, 2.6]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
}
