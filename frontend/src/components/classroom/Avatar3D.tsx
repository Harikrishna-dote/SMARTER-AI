// 3D AI Teacher Avatar renderer using React Three Fiber.

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarEngine } from '../../features/avatar/avatarEngine';
import { AvatarState, AVATAR_PERSONA_COLORS, AvatarPersona } from '../../features/avatar/avatarTypes';

interface Avatar3DProps {
  engine: AvatarEngine;
  state: AvatarState;
  width?: number;
  height?: number;
}

function AvatarHead({
  expression,
  persona,
  isBlinking,
  breathOffset,
}: {
  expression: { mouthOpen: number; mouthSmile: number; eyebrowRaise: number; eyeBlink: number; headTilt: number };
  persona: AvatarPersona;
  isBlinking: boolean;
  breathOffset: number;
}) {
  const headRef = useRef<THREE.Group>();
  const leftEyeRef = useRef<THREE.Mesh | null>(null);
  const rightEyeRef = useRef<THREE.Mesh | null>(null);
  const mouthRef = useRef<THREE.Mesh | null>(null);
  const leftEyebrowRef = useRef<THREE.Mesh | null>(null);
  const rightEyebrowRef = useRef<THREE.Mesh | null>(null);
  const colors = AVATAR_PERSONA_COLORS[persona];

  useFrame((_, delta) => {
    if (!headRef.current) return;
    headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, expression.headTilt, delta * 5);
    headRef.current.position.y = breathOffset;

    if (leftEyeRef.current && rightEyeRef.current) {
      const blinkScale = isBlinking ? 0.1 : 1;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, blinkScale, delta * 20);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, blinkScale, delta * 20);
    }

    if (mouthRef.current) {
      const mouthY = 0.1 + expression.mouthOpen * 0.3;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, Math.max(0.1, mouthY), delta * 15);
      mouthRef.current.position.y = THREE.MathUtils.lerp(mouthRef.current.position.y, -0.15 + expression.mouthOpen * 0.1, delta * 15);
    }

    if (leftEyebrowRef.current && rightEyebrowRef.current) {
      const browY = expression.eyebrowRaise * 0.15;
      leftEyebrowRef.current.position.y = THREE.MathUtils.lerp(leftEyebrowRef.current.position.y, 0.35 + browY, delta * 10);
      rightEyebrowRef.current.position.y = THREE.MathUtils.lerp(rightEyebrowRef.current.position.y, 0.35 + browY, delta * 10);
    }
  });

  return (
    <group ref={headRef as any} position={[0, 1.65, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshStandardMaterial color={colors.skin} roughness={0.7} metalness={0.0} />
      </mesh>

      <mesh position={[0, -0.02, 0.18]} castShadow>
        <capsuleGeometry args={[0.08, 0.06, 4, 8]} />
        <meshStandardMaterial color={colors.hair} roughness={0.9} metalness={0.0} />
      </mesh>

      <mesh ref={leftEyeRef} position={[-0.08, 0.04, 0.2]} castShadow>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh ref={rightEyeRef} position={[0.08, 0.04, 0.2]} castShadow>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.3} />
      </mesh>

      <mesh ref={mouthRef} position={[0, -0.14, 0.2]} castShadow>
        <capsuleGeometry args={[0.06, 0.02, 4, 8]} />
        <meshStandardMaterial color="#c44" roughness={0.5} metalness={0.0} />
      </mesh>

      <mesh ref={leftEyebrowRef} position={[-0.08, 0.34, 0.2]} rotation={[0, 0, expression.eyebrowRaise * 0.3]} castShadow>
        <capsuleGeometry args={[0.04, 0.01, 4, 8]} />
        <meshStandardMaterial color={colors.hair} roughness={0.8} metalness={0.0} />
      </mesh>
      <mesh ref={rightEyebrowRef} position={[0.08, 0.34, 0.2]} rotation={[0, 0, -expression.eyebrowRaise * 0.3]} castShadow>
        <capsuleGeometry args={[0.04, 0.01, 4, 8]} />
        <meshStandardMaterial color={colors.hair} roughness={0.8} metalness={0.0} />
      </mesh>

      <mesh position={[0, -0.02, -0.18]} castShadow>
        <capsuleGeometry args={[0.2, 0.15, 4, 8]} />
        <meshStandardMaterial color={colors.hair} roughness={0.9} metalness={0.0} />
      </mesh>

      {colors.hasGlasses && (
        <group position={[0, 0.04, 0.22]}>
          <mesh>
            <torusGeometry args={[0.06, 0.005, 8, 16]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.07, 8]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.07, 8]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function AvatarBody({ persona, breathOffset }: { persona: AvatarPersona; breathOffset: number }) {
  const torsoRef = useRef<THREE.Mesh | null>(null);
  const jacketRef = useRef<THREE.Mesh | null>(null);
  const colors = AVATAR_PERSONA_COLORS[persona];

  useFrame((_, delta) => {
    if (!torsoRef.current || !jacketRef.current) return;
    torsoRef.current.position.y = breathOffset * 0.5;
    jacketRef.current.position.y = breathOffset * 0.5;
  });

  return (
    <group position={[0, 1.2 + breathOffset * 0.5, 0]}>
      <mesh ref={torsoRef} castShadow receiveShadow>
        <capsuleGeometry args={[0.15, 0.35, 4, 8]} />
        <meshStandardMaterial color={colors.skin} roughness={0.7} metalness={0.0} />
      </mesh>
      <mesh ref={jacketRef} castShadow receiveShadow>
        <capsuleGeometry args={[0.19, 0.4, 4, 8]} />
        <meshStandardMaterial color={colors.suit} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.15, 0.16]} castShadow>
        <capsuleGeometry args={[0.06, 0.08, 4, 8]} />
        <meshStandardMaterial color={colors.accent} roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  );
}

function AvatarArm({
  side,
  angle,
  handPosition,
  color,
  breathOffset,
  gesture,
}: {
  side: 'left' | 'right';
  angle: number;
  handPosition: [number, number, number];
  color: string;
  breathOffset: number;
  gesture: string;
}) {
  const shoulderRef = useRef<THREE.Group | null>(null);
  const forearmRef = useRef<THREE.Group | null>(null);
  const upperArmRef = useRef<THREE.Mesh | null>(null);
  const lowerArmRef = useRef<THREE.Mesh | null>(null);
  const sign = side === 'left' ? -1 : 1;

  useFrame((_, delta) => {
    if (!shoulderRef.current || !forearmRef.current) return;
    shoulderRef.current.rotation.z = sign * angle;
    forearmRef.current.rotation.z = sign * (angle * 0.5);

    if (upperArmRef.current) {
      upperArmRef.current.rotation.x = Math.sin(performance.now() * 0.003 + sign) * 0.02;
    }
    if (lowerArmRef.current) {
      lowerArmRef.current.rotation.x = Math.sin(performance.now() * 0.004 + sign) * 0.03;
    }
  });

  const isPointing = gesture === 'pointing';
  const laserRef = useRef<THREE.Mesh | null>(null);

  useFrame(() => {
    if (laserRef.current && isPointing) {
      laserRef.current.visible = true;
    } else if (laserRef.current) {
      laserRef.current.visible = false;
    }
  });

  return (
    <group position={[sign * 0.22, 1.45 + breathOffset * 0.5, 0]}>
      <group ref={shoulderRef}>
        <mesh ref={upperArmRef} castShadow>
          <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
        </mesh>
        <group ref={forearmRef} position={[sign * 0.12, -0.28, 0]}>
          <mesh ref={lowerArmRef} castShadow>
            <capsuleGeometry args={[0.06, 0.24, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={handPosition} castShadow>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#f5d0a9" roughness={0.7} metalness={0.0} />
          </mesh>
          {side === 'right' && isPointing && (
            <mesh ref={laserRef} position={[0, 0.05, 0.12]} castShadow>
              <cylinderGeometry args={[0.01, 0.005, 0.2, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} roughness={0.1} metalness={0.1} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

function AvatarLegs({ color, breathOffset }: { color: string; breathOffset: number }) {
  const leftLegRef = useRef<THREE.Mesh | null>(null);
  const rightLegRef = useRef<THREE.Mesh | null>(null);
  const leftShoeRef = useRef<THREE.Mesh | null>(null);
  const rightShoeRef = useRef<THREE.Mesh | null>(null);

  useFrame((_, delta) => {
    if (!leftLegRef.current || !rightLegRef.current) return;
    leftLegRef.current.position.y = breathOffset * 0.3;
    rightLegRef.current.position.y = breathOffset * 0.3;
    if (leftShoeRef.current) leftShoeRef.current.position.y = breathOffset * 0.3;
    if (rightShoeRef.current) rightShoeRef.current.position.y = breathOffset * 0.3;
  });

  return (
    <group position={[0, 0.55 + breathOffset * 0.3, 0]}>
      <mesh ref={leftLegRef} position={[-0.1, -0.28, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.08, 0.38, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.1, -0.28, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.08, 0.38, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh ref={leftShoeRef} position={[-0.1, -0.55, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.08, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh ref={rightShoeRef} position={[0.1, -0.55, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.08, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  );
}

export function Avatar3D({ engine, state }: Avatar3DProps) {
  const groupRef = useRef<THREE.Group>();
  const colors = AVATAR_PERSONA_COLORS[state.persona];

  const frameData = useMemo(() => engine.update(16, performance.now()), [engine, state]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, frameData.gesture.bodyRotation, delta * 3);
  });

  return (
    <group ref={groupRef as any}>
      <AvatarHead
        expression={frameData.expression}
        persona={state.persona}
        isBlinking={frameData.isBlinking}
        breathOffset={frameData.breathOffset}
      />
      <AvatarBody persona={state.persona} breathOffset={frameData.breathOffset} />
      <AvatarArm
        side="left"
        angle={frameData.gesture.leftArmAngle}
        handPosition={frameData.gesture.leftHandPosition}
        color={colors.suitDark}
        breathOffset={frameData.breathOffset}
        gesture={frameData.gesture.name}
      />
      <AvatarArm
        side="right"
        angle={frameData.gesture.rightArmAngle}
        handPosition={frameData.gesture.rightHandPosition}
        color={colors.suitDark}
        breathOffset={frameData.breathOffset}
        gesture={frameData.gesture.name}
      />
      <AvatarLegs color={colors.suitDark} breathOffset={frameData.breathOffset} />
    </group>
  );
}
