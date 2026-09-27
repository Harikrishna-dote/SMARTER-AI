// Main 3D avatar scene combining environment, avatar, and camera.

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Avatar3D } from './Avatar3D';
import { ClassroomEnvironment } from './ClassroomEnvironment';
import { CameraController, CameraMode } from './CameraController';
import { AvatarEngine } from '../../features/avatar/avatarEngine';
import type { AvatarState } from '../../features/avatar/avatarTypes';

interface AvatarSceneProps {
  engine: AvatarEngine;
  state: AvatarState;
  cameraMode?: CameraMode;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  showControls?: boolean;
  className?: string;
  whiteboardContent?: string;
  interactive?: boolean;
}

function SceneContent({ engine, state, cameraMode, quality, whiteboardContent, interactive }: AvatarSceneProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[2, 1.8, 4]} fov={50} />
      <CameraController mode={cameraMode || 'default'} quality={quality || state.quality} fullscreen={state.fullscreen} />
      <ClassroomEnvironment quality={quality || state.quality} fullscreen={state.fullscreen} whiteboardContent={whiteboardContent} />
      <Avatar3D engine={engine} state={state} />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      {quality === 'ultra' && <Environment preset="city" />}
      {interactive && quality !== 'low' && <OrbitControls enablePan={false} minDistance={2} maxDistance={8} target={[0, 1.2, 0]} />}
    </>
  );
}

export function AvatarScene({ engine, state, cameraMode, quality, showControls, className, whiteboardContent, interactive }: AvatarSceneProps) {
  const effectiveQuality = useMemo(() => {
    if (quality) return quality;
    return state.quality;
  }, [quality, state.quality]);

  return (
    <div className={className || 'h-full w-full'} style={{ background: '#0f172a' }}>
      <Canvas
        shadows
        dpr={effectiveQuality === 'ultra' ? [1, 2] : [1, 1.5]}
        gl={{ antialias: effectiveQuality !== 'low', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <Suspense fallback={null}>
          <SceneContent engine={engine} state={state} cameraMode={cameraMode} quality={effectiveQuality} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default AvatarScene;
