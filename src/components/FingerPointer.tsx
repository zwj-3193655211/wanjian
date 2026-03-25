import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

export function FingerPointer() {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPosition = useHandStore((state) => state.targetPosition);
  const mousePosition = useHandStore((state) => state.mousePosition);
  const isTracking = useHandStore((state) => state.isTracking);
  const gestureMode = useHandStore((state) => state.gestureMode);

  // 当前位置（用于平滑过渡）
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    // 所有模式都显示白点
    meshRef.current.visible = true;

    // 使用鼠标位置或手部位置
    const target = isTracking ? targetPosition : mousePosition;
    currentPos.current.lerp(target, 0.3);
    meshRef.current.position.copy(currentPos.current);

    // 添加脉冲效果
    const pulse = Math.sin(clock.getElapsedTime() * 5) * 0.2 + 1;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      {/* 核心白点 */}
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
    </mesh>
  );
}
