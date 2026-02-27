import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

export function FingerPointer() {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPosition = useHandStore((state) => state.targetPosition);
  const isTracking = useHandStore((state) => state.isTracking);
  const gestureMode = useHandStore((state) => state.gestureMode);
  
  // 当前位置（用于平滑过渡）
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    // 只在游龙模式(DRAGON)下显示
    const visible = isTracking && gestureMode === 'DRAGON';
    meshRef.current.visible = visible;
    
    if (!visible) return;
    
    // 平滑跟随目标位置
    currentPos.current.lerp(targetPosition, 0.3);
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
