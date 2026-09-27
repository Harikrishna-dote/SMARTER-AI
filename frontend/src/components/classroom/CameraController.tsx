// Camera controller for the AI Teacher Avatar virtual classroom.

import { useRef, useMemo } from 'react';
import { useFrame, Camera } from '@react-three/fiber';
import * as THREE from 'three';

export type CameraMode = 'default' | 'teacher_closeup' | 'whiteboard_focus' | 'diagram_focus' | 'student_view' | 'overview';

interface CameraControllerProps {
  mode: CameraMode;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fullscreen?: boolean;
  lookAtTarget?: THREE.Vector3;
}

export function CameraController({ mode, quality, fullscreen = false, lookAtTarget }: CameraControllerProps) {
  const cameraRef = useRef<Camera>(null);

  const targetPosition = useMemo(() => {
    switch (mode) {
      case 'teacher_closeup':
        return new THREE.Vector3(0, 1.4, 2.5);
      case 'whiteboard_focus':
        return new THREE.Vector3(0, 1.6, 3.2);
      case 'diagram_focus':
        return new THREE.Vector3(1.5, 1.3, 3);
      case 'student_view':
        return new THREE.Vector3(0, 1.0, 4.5);
      case 'overview':
        return new THREE.Vector3(4, 3, 6);
      default:
        return new THREE.Vector3(2, 1.8, 4);
    }
  }, [mode]);

  const targetLookAt = useMemo(() => {
    if (lookAtTarget) return lookAtTarget;
    switch (mode) {
      case 'teacher_closeup':
        return new THREE.Vector3(0, 1.4, 0);
      case 'whiteboard_focus':
        return new THREE.Vector3(0, 1.5, -4.5);
      case 'diagram_focus':
        return new THREE.Vector3(0, 1.2, 0);
      case 'student_view':
        return new THREE.Vector3(0, 1.5, -2);
      case 'overview':
        return new THREE.Vector3(0, 1.2, 0);
      default:
        return new THREE.Vector3(0, 1.2, 0);
    }
  }, [mode, lookAtTarget]);

  const fov = useMemo(() => {
    switch (mode) {
      case 'teacher_closeup':
        return 45;
      case 'whiteboard_focus':
        return 50;
      case 'overview':
        return 60;
      default:
        return 50;
    }
  }, [mode]);

  useFrame((_, delta) => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current as THREE.PerspectiveCamera;

    camera.position.lerp(targetPosition, delta * 2);
    camera.fov = THREE.MathUtils.lerp(camera.fov, fov, delta * 3);
    camera.updateProjectionMatrix();

    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.add(camera.position);
    currentLookAt.lerp(targetLookAt, delta * 2);
    camera.lookAt(targetLookAt);
  });

  return null;
}
