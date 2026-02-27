import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

export function MagicCircle() {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  const geometry1 = useMemo(() => new THREE.RingGeometry(28, 30, 64), []);
  const geometry2 = useMemo(() => new THREE.RingGeometry(32, 33, 64), []);
  const geometry3 = useMemo(() => new THREE.RingGeometry(34, 34.5, 64), []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const gestureMode = useHandStore.getState().gestureMode;
    const isTracking = useHandStore.getState().isTracking;

    if (groupRef.current) {
      const target = useHandStore.getState().targetPosition;
      groupRef.current.position.copy(target);
      groupRef.current.position.z -= 5;
    }

    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = time * 0.5;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -time * 0.3;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = time * 0.2;
    }

    // 根据模式调整可见性和颜色
    const visible = gestureMode === 'DAGENG' && isTracking;
    if (groupRef.current) {
      groupRef.current.visible = visible;
      if (visible) {
        groupRef.current.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
      }
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ring1Ref} geometry={geometry1} material={material} />
      <mesh ref={ring2Ref} geometry={geometry2} material={material} />
      <mesh ref={ring3Ref} geometry={geometry3} material={material} />
    </group>
  );
}
