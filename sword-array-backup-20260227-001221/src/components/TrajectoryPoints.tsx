import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

// 白点指示器 - 只显示当前手指位置，不要轨迹
export function TrajectoryPoints() {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // 只需要一个点
    const positions = new Float32Array([0, 0, 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame(() => {
    const state = useHandStore.getState();
    const gestureMode = state.gestureMode;
    const isTracking = state.isTracking;
    const target = state.targetPosition;

    // 只在游龙和大剑模式显示白点
    const showPoint = isTracking && (gestureMode === 'DRAGON' || gestureMode === 'GREATSWORD');

    if (pointsRef.current) {
      if (showPoint) {
        const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
        positions[0] = target.x;
        positions[1] = target.y;
        positions[2] = target.z;
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
        pointsRef.current.visible = true;
      } else {
        pointsRef.current.visible = false;
      }
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} visible={false} />
  );
}