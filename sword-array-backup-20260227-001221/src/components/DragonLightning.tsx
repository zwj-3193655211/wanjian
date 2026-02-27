import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

// 龙头特效 - 剑群形成龙头形状，配上金色雷霆
export function DragonHead() {
  const dragonRef = useRef<THREE.Group>(null);
  const lightningRef = useRef<THREE.LineSegments>(null);
  const breathRef = useRef<THREE.Points>(null);
  
  // 龙头粒子
  const dragonParticles = useMemo(() => {
    const positions: number[] = [];
    const count = 150;
    
    // 龙头形状
    for (let i = 0; i < count; i++) {
      const t = i / count;
      
      // 龙头轮廓：从吻部到颈部
      const length = t * 20;
      
      // 龙头宽度变化
      const widthProfile = Math.sin(t * Math.PI) * 4;
      const heightProfile = Math.sin(t * Math.PI) * 3;
      
      // 添加起伏模拟龙鳞
      const noise = Math.sin(t * 20) * 0.3;
      
      const x = (Math.random() - 0.5) * widthProfile + noise;
      const y = Math.random() * heightProfile - heightProfile * 0.3;
      const z = -length;
      
      positions.push(x, y, z);
    }
    
    // 龙角
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const baseX = 3 + t * 5;
      const y = 2 + t * 4;
      const z = -5 - t * 3;
      positions.push(baseX, y, z);
      positions.push(-baseX, y, z);
    }
    
    // 龙须
    for (let i = 0; i < 15; i++) {
      positions.push(Math.random() * 2 - 1, -0.5, Math.random() * 3);
    }
    
    return positions;
  }, []);
  
  // 金色雷霆
  const lightningGeometry = useMemo(() => {
    const positions: number[] = [];
    
    // 少量金色闪电
    for (let i = 0; i < 15; i++) {
      const startX = (Math.random() - 0.5) * 8;
      const startY = (Math.random() - 0.5) * 6;
      const startZ = (Math.random() - 0.5) * 15;
      
      // 从龙头向外延伸
      const length = 5 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      
      let prevX = startX, prevY = startY, prevZ = startZ;
      
      for (let j = 1; j <= 4; j++) {
        const t = j / 4;
        const x = startX + Math.cos(angle) * length * t + (Math.random() - 0.5) * 2;
        const y = startY + (Math.random() - 0.5) * 2;
        const z = startZ + Math.sin(angle) * length * t + (Math.random() - 0.5) * 2;
        
        positions.push(prevX, prevY, prevZ, x, y, z);
        prevX = x; prevY = y; prevZ = z;
      }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  // 龙息粒子
  const breathGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(100 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  const dragonMaterial = useMemo(() => new THREE.PointsMaterial({
    color: 0xffcc00,
    size: 0.8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  }), []);
  
  const lightningMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: 0xffdd44,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  }), []);
  
  const breathMaterial = useMemo(() => new THREE.PointsMaterial({
    color: 0xff6600,
    size: 0.5,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const state = useHandStore.getState();
    const isDragonClaw = state.gestureMode === 'DRAGON_CLAW' && state.isTracking;
    const target = state.targetPosition;
    
    if (dragonRef.current) {
      dragonRef.current.visible = isDragonClaw;
      
      if (isDragonClaw) {
        dragonRef.current.position.copy(target);
        dragonRef.current.position.z -= 10;
        
        // 龙头摆动
        dragonRef.current.rotation.y = Math.sin(time * 2) * 0.2;
        dragonRef.current.rotation.x = Math.sin(time * 1.5) * 0.1;
        
        // 金色闪烁
        const mat = dragonRef.current.children[0] as THREE.Points;
        if (mat.material) {
          (mat.material as THREE.PointsMaterial).color.setHSL(0.12 + Math.sin(time * 5) * 0.02, 1, 0.6);
        }
      }
    }
    
    // 闪电闪烁
    if (lightningRef.current) {
      lightningRef.current.visible = isDragonClaw;
      if (isDragonClaw) {
        lightningRef.current.position.copy(target);
        lightningRef.current.position.z -= 10;
        (lightningRef.current.material as THREE.LineBasicMaterial).opacity = Math.random() > 0.3 ? 0.8 : 0.2;
      }
    }
    
    // 龙息粒子动画
    if (breathRef.current) {
      breathRef.current.visible = isDragonClaw;
      if (isDragonClaw) {
        breathRef.current.position.copy(target);
        breathRef.current.position.z -= 10;
        
        const positions = breathRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < 100; i++) {
          positions[i * 3 + 2] += 0.5; // 向前移动
          if (positions[i * 3 + 2] > 30) {
            positions[i * 3] = (Math.random() - 0.5) * 2;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1;
            positions[i * 3 + 2] = 0;
          }
        }
        breathRef.current.geometry.attributes.position.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={dragonRef} visible={false}>
      {/* 龙头粒子 */}
      <points geometry={useMemo(() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(dragonParticles, 3));
        return geo;
      }, [])}>
        <primitive object={dragonMaterial} attach="material" />
      </points>
      
      {/* 龙息 */}
      <points ref={breathRef} geometry={breathGeometry} material={breathMaterial} />
      
      {/* 金色雷霆 */}
      <lineSegments ref={lightningRef} geometry={lightningGeometry} material={lightningMaterial} />
    </group>
  );
}