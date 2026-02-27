import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

// ✌️ 胜利手势专属效果 - 天剑降临
// 飞剑从天而降，形成光环爆发，然后螺旋上升消散

export function VictoryExplosion() {
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  
  // 粒子状态
  const particleCount = 200;
  const particlePositions = useRef<Float32Array>(new Float32Array(particleCount * 3));
  const particleVelocities = useRef<Float32Array>(new Float32Array(particleCount * 3));
  const particleColors = useRef<Float32Array>(new Float32Array(particleCount * 3));
  const particleLifetimes = useRef<Float32Array>(new Float32Array(particleCount));
  
  // 光环状态
  const ringScale = useRef(0);
  const ringOpacity = useRef(0);
  const lastGestureMode = useRef<string>('');
  const explosionTriggered = useRef(false);
  const explosionTime = useRef(0);

  // 粒子几何体
  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particlePositions.current, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(particleColors.current, 3));
    return geo;
  }, []);

  // 光环几何体 - 多层光环
  const ringGeometry = useMemo(() => {
    return new THREE.RingGeometry(0.5, 8, 64);
  }, []);

  // 光环材质
  const ringMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // 粒子材质
  const particleMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.3,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const gestureMode = useHandStore.getState().gestureMode;
    const isTracking = useHandStore.getState().isTracking;
    const target = useHandStore.getState().targetPosition;

    const isVictory = gestureMode === 'DAGENG' && isTracking;

    // 检测手势变化，触发爆炸效果
    if (isVictory && lastGestureMode.current !== 'DAGENG') {
      explosionTriggered.current = true;
      explosionTime.current = time;
      ringScale.current = 0;
      ringOpacity.current = 1;
      
      // 初始化粒子
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = Math.random() * 2;
        
        particlePositions.current[i * 3] = target.x + Math.cos(angle) * radius;
        particlePositions.current[i * 3 + 1] = target.y + 15 + Math.random() * 10; // 从上方落下
        particlePositions.current[i * 3 + 2] = target.z + Math.sin(angle) * radius;
        
        // 速度：向下然后向外爆发
        particleVelocities.current[i * 3] = (Math.random() - 0.5) * 20;
        particleVelocities.current[i * 3 + 1] = -30 - Math.random() * 20;
        particleVelocities.current[i * 3 + 2] = (Math.random() - 0.5) * 20;
        
        // 金色到白色的渐变
        const colorMix = Math.random();
        particleColors.current[i * 3] = 1;
        particleColors.current[i * 3 + 1] = 0.8 + colorMix * 0.2;
        particleColors.current[i * 3 + 2] = 0.3 + colorMix * 0.7;
        
        particleLifetimes.current[i] = 1.0;
      }
    }

    lastGestureMode.current = gestureMode;

    // 更新光环
    if (ringRef.current) {
      if (isVictory) {
        const elapsed = time - explosionTime.current;
        
        if (elapsed < 2) {
          // 光环扩散
          ringScale.current = THREE.MathUtils.lerp(ringScale.current, 3, 0.05);
          ringOpacity.current = THREE.MathUtils.lerp(ringOpacity.current, 0.6, 0.1);
        } else {
          // 淡出
          ringOpacity.current = THREE.MathUtils.lerp(ringOpacity.current, 0, 0.05);
        }
        
        ringRef.current.position.copy(target);
        ringRef.current.position.y -= 5;
        ringRef.current.rotation.x = -Math.PI / 2;
        ringRef.current.scale.setScalar(ringScale.current);
        ringRef.current.lookAt(target);
        
        (ringRef.current.material as THREE.MeshBasicMaterial).opacity = ringOpacity.current;
        ringRef.current.visible = ringOpacity.current > 0.01;
      } else {
        ringRef.current.visible = false;
        ringScale.current = 0;
        ringOpacity.current = 0;
      }
    }

    // 更新粒子
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
      
      if (isVictory) {
        const elapsed = time - explosionTime.current;
        
        for (let i = 0; i < particleCount; i++) {
          if (particleLifetimes.current[i] <= 0) continue;
          
          const elapsed = time - explosionTime.current;
          
          // 阶段1：下落 (0-0.5s)
          if (elapsed < 0.5) {
            positions[i * 3] += particleVelocities.current[i * 3] * 0.016 * 0.3;
            positions[i * 3 + 1] += particleVelocities.current[i * 3 + 1] * 0.016;
            positions[i * 3 + 2] += particleVelocities.current[i * 3 + 2] * 0.016 * 0.3;
          } 
          // 阶段2：到达目标后爆发 (0.5s后)
          else {
            // 螺旋上升消散
            const angle = elapsed * 3 + (i / particleCount) * Math.PI * 2;
            const riseSpeed = 15 + Math.random() * 10;
            const expandSpeed = 8;
            
            const dx = positions[i * 3] - target.x;
            const dz = positions[i * 3 + 2] - target.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            positions[i * 3] += Math.cos(angle) * expandSpeed * 0.016;
            positions[i * 3 + 1] += riseSpeed * 0.016;
            positions[i * 3 + 2] += Math.sin(angle) * expandSpeed * 0.016;
            
            // 淡出
            particleLifetimes.current[i] -= 0.02;
            
            // 颜色渐变：金色 → 红色 → 消失
            const life = particleLifetimes.current[i];
            colors[i * 3] = 1;
            colors[i * 3 + 1] = life * 0.8;
            colors[i * 3 + 2] = life * 0.3;
          }
          
          // 靠近目标时减速
          const dy = positions[i * 3 + 1] - target.y;
          if (dy < 2 && elapsed < 0.5) {
            particleVelocities.current[i * 3 + 1] *= 0.9;
          }
        }
        
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
        particlesRef.current.geometry.attributes.color.needsUpdate = true;
        particlesRef.current.visible = true;
      } else {
        particlesRef.current.visible = false;
        // 重置粒子生命周期
        for (let i = 0; i < particleCount; i++) {
          particleLifetimes.current[i] = 1.0;
        }
      }
    }

    // 更新光源
    if (lightRef.current) {
      if (isVictory) {
        const elapsed = time - explosionTime.current;
        const intensity = elapsed < 1 ? elapsed * 5 : Math.max(0, 5 - elapsed * 2);
        lightRef.current.intensity = intensity;
        lightRef.current.position.copy(target);
        lightRef.current.position.y += 2;
        lightRef.current.visible = true;
      } else {
        lightRef.current.visible = false;
        lightRef.current.intensity = 0;
      }
    }
  });

  return (
    <group>
      {/* 光环 */}
      <mesh ref={ringRef} geometry={ringGeometry} material={ringMaterial} visible={false} />
      
      {/* 粒子 */}
      <points ref={particlesRef} geometry={particleGeometry} material={particleMaterial} visible={false} />
      
      {/* 动态光源 */}
      <pointLight ref={lightRef} color="#ffdd44" intensity={0} distance={50} visible={false} />
    </group>
  );
}
