import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

export function ShieldOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(2, 32, 32), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const gestureMode = useHandStore.getState().gestureMode;
    const isTracking = useHandStore.getState().isTracking;
    const target = useHandStore.getState().targetPosition;

    if (meshRef.current) {
      // 隐藏蓝圈，握拳时只显示剑阵居中效果
      meshRef.current.visible = false;
      
      if (gestureMode === 'GATHER' && isTracking) {
        meshRef.current.position.copy(target);
      }
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} visible={false} />
  );
}
