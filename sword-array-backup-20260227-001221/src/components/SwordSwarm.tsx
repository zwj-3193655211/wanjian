import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useHandStore, CONFIG } from '../store';

// 简化版 Simplex Noise
const simplex = {
  noise3D: (x: number, y: number, z: number) => {
    return (
      Math.sin(x * 1.2 + y * 0.8) *
      Math.cos(y * 1.1 + z * 0.9) *
      Math.sin(z * 0.7 + x * 1.3)
    );
  },
};

export function SwordSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 物理状态
  const positions = useRef<THREE.Vector3[]>([]);
  const velocities = useRef<THREE.Vector3[]>([]);
  const swordScales = useRef<number[]>([]);

  // 初始化
  if (positions.current.length === 0) {
    for (let i = 0; i < CONFIG.swordCount; i++) {
      positions.current.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 10 - 5
        )
      );
      velocities.current.push(new THREE.Vector3());
      swordScales.current.push(1);
    }
  }

  // 剑形几何体
  const geometry = useMemo(() => {
    const bladeGeo = new THREE.ConeGeometry(0.12, 2.5, 4);
    bladeGeo.scale(0.4, 1, 1);
    bladeGeo.rotateX(Math.PI / 2);
    bladeGeo.translate(0, 0, 1.0);

    const guardGeo = new THREE.BoxGeometry(0.5, 0.08, 0.15);
    guardGeo.translate(0, 0, -0.2);

    const handleGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6);
    handleGeo.rotateX(Math.PI / 2);
    handleGeo.translate(0, 0, -0.6);

    const merged = mergeGeometries([bladeGeo, guardGeo, handleGeo]);
    return merged || bladeGeo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  const auraGeometry = useMemo(() => {
    const auraGeo = new THREE.ConeGeometry(0.15, 2.6, 4);
    auraGeo.scale(0.5, 1, 1);
    auraGeo.rotateX(Math.PI / 2);
    auraGeo.translate(0, 0, 1.0);
    return auraGeo;
  }, []);

  const auraMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const state = useHandStore.getState();
    const targetPosition = state.targetPosition;
    const isTracking = state.isTracking;
    const gestureMode = state.gestureMode;
    const pathHistory = state.pathHistory;
    const handRotation = state.handRotation;
    const twoFingerDir = state.twoFingerDirection;

    const time = clock.getElapsedTime();
    const delta = 1 / 60;

    // 无手势时自动盘旋
    let currentTarget = targetPosition.clone();
    if (!isTracking) {
      currentTarget.set(0, 0, 0);
      pathHistory.pop();
      pathHistory.unshift(currentTarget.clone());
    } else if (gestureMode === 'DRAGON') {
      state.extendPath();
    }

    // 根据模式计算目标
    for (let i = 0; i < CONFIG.swordCount; i++) {
      const pos = positions.current[i];
      const vel = velocities.current[i];
      const target = new THREE.Vector3();
      let targetScale = 1;

      switch (gestureMode) {
        // ===== 0指 - 剑聚：螺旋收缩到一点 =====
        case 'SWORD_CONVERGE': {
          const spiralAngle = time * 8 + (i / CONFIG.swordCount) * Math.PI * 2;
          const spiralRadius = Math.max(0.5, 8 - time * 2) * (1 - i / CONFIG.swordCount * 0.5);
          const heightOffset = Math.sin(time * 3 + i * 0.1) * 2;
          
          target.set(
            currentTarget.x + Math.cos(spiralAngle) * spiralRadius,
            currentTarget.y + heightOffset + (i / CONFIG.swordCount) * 5,
            currentTarget.z + Math.sin(spiralAngle) * spiralRadius
          );
          break;
        }

        // ===== 1指 - 游龙：跟随路径 =====
        case 'DRAGON': {
          if (i < 5) {
            target.copy(currentTarget);
            target.x += Math.sin(time * 8 + i) * 0.3;
            target.y += Math.cos(time * 8 + i) * 0.3;
          } else {
            const pathIdx = i * 0.8;
            const idxA = Math.min(Math.floor(pathIdx), pathHistory.length - 1);
            const idxB = Math.min(idxA + 1, pathHistory.length - 1);
            const alpha = pathIdx - Math.floor(pathIdx);

            if (pathHistory[idxA] && pathHistory[idxB]) {
              target.lerpVectors(pathHistory[idxA], pathHistory[idxB], alpha);
            } else {
              target.copy(currentTarget);
            }

            target.x += Math.sin(time * 10 + i * 0.5) * 0.2;
            target.y += Math.cos(time * 10 + i * 0.5) * 0.2;

            const ns = CONFIG.noiseScale;
            const na = CONFIG.noiseStrength * (0.8 + Math.sin(time * 2 + i * 0.05) * 0.4);
            target.x += simplex.noise3D(pos.x * ns, pos.y * ns, time) * na;
            target.y += simplex.noise3D(pos.y * ns, pos.z * ns, time + 100) * na;
            target.z += simplex.noise3D(pos.z * ns, pos.x * ns, time + 200) * na;
          }
          break;
        }

        // ===== 2指 - 大剑：融合成一把巨剑 =====
        case 'GREATSWORD': {
          // 剑身排列：形成一把超大剑
          const swordLength = 15;
          const swordWidth = 3;
          const thickness = 2;
          
          // 沿两指方向排列
          const dir = new THREE.Vector3(twoFingerDir.x, twoFingerDir.y, twoFingerDir.z).normalize();
          
          // 剑尖到剑柄的分布
          const t = i / CONFIG.swordCount;
          const lengthPos = t * swordLength - swordLength * 0.3;
          
          // 剑的宽度分布（中间宽两端窄）
          const widthFactor = Math.sin(t * Math.PI);
          const widthPos = (Math.random() - 0.5) * swordWidth * widthFactor;
          const thicknessPos = (Math.random() - 0.5) * thickness * widthFactor;
          
          // 基于手部旋转计算朝向
          const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(
            new THREE.Euler(handRotation.pitch, handRotation.yaw, handRotation.roll)
          );
          
          const localPos = new THREE.Vector3(widthPos, thicknessPos, lengthPos);
          localPos.applyMatrix4(rotMatrix);
          
          target.copy(currentTarget).add(localPos);
          
          // 剑尖部分放大
          targetScale = t > 0.8 ? 1.5 : 1.0;
          break;
        }

        // ===== 3指 - 剑阵：大庚剑阵 =====
        case 'SWORD_ARRAY': {
          // 第一把剑作为中心大剑
          if (i === 0) {
            target.set(currentTarget.x, currentTarget.y + 5, currentTarget.z);
            targetScale = 6;
          } else {
            // 多层环形剑阵，每层反向旋转
            const effectiveI = i - 1;
            const effectiveCount = CONFIG.swordCount - 1;

            const layerCount = 10;
            const perLayer = Math.max(1, Math.floor(effectiveCount / layerCount));
            const layerIdx = Math.floor(effectiveI / perLayer);
            const idxInLayer = effectiveI % perLayer;

            const radius = CONFIG.swordArrayRadius + layerIdx * 1.5 + 2;

            const dir = layerIdx % 2 === 0 ? 1 : -1;
            const theta = (idxInLayer / perLayer) * Math.PI * 2 + time * CONFIG.swordArrayRotateSpeed * dir;

            const hCenter = currentTarget.y - 10;
            const hRange = CONFIG.swordArrayHeight;
            const hRand = Math.sin(effectiveI * 13.1) * 0.5 + 0.5;
            const height = hCenter + (hRand - 0.5) * hRange;

            target.set(
              currentTarget.x + Math.cos(theta) * radius,
              height,
              currentTarget.z + Math.sin(theta) * radius
            );
            targetScale = 1.5;
          }
          break;
        }

        // ===== 4指 - 剑散：向外扩散 =====
        case 'SWORD_SCATTER': {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / CONFIG.swordCount);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          
          const expandRadius = 25 + Math.sin(time * 2) * 5;
          
          target.set(
            currentTarget.x + Math.sin(phi) * Math.cos(theta) * expandRadius,
            currentTarget.y + Math.sin(phi) * Math.sin(theta) * expandRadius,
            currentTarget.z + Math.cos(phi) * expandRadius
          );
          
          target.x += simplex.noise3D(i * 0.1, time, 0) * 3;
          target.y += simplex.noise3D(0, i * 0.1, time) * 3;
          break;
        }

        // ===== 5指 - 龙爪：5组形成爪形 =====
        case 'DRAGON_CLAW': {
          const clawIndex = Math.floor((i / CONFIG.swordCount) * 5);
          const posInClaw = (i % (CONFIG.swordCount / 5)) / (CONFIG.swordCount / 5);
          
          // 5个爪子的基础角度
          const clawAngles = [-60, -30, 0, 30, 60].map(d => d * Math.PI / 180);
          const baseAngle = clawAngles[clawIndex];
          
          // 爪子从手掌延伸出去
          const clawLength = 5 + posInClaw * 15;
          const spreadAngle = baseAngle + Math.sin(time * 3 + clawIndex) * 0.2;
          
          // 抓取动作
          const grabFactor = Math.sin(time * 2) * 0.3;
          const bendAngle = posInClaw * grabFactor;
          
          target.set(
            currentTarget.x + Math.cos(spreadAngle + bendAngle) * clawLength,
            currentTarget.y - posInClaw * 3,
            currentTarget.z + Math.sin(spreadAngle + bendAngle) * clawLength
          );
          
          targetScale = 1.3;
          break;
        }

        default:
          target.copy(currentTarget);
      }

      // 动态速度
      let speed = CONFIG.maxSpeed;
      if (target.distanceTo(pos) > 4) speed = CONFIG.sprintSpeed;
      else if (target.distanceTo(pos) < 1) speed = target.distanceTo(pos) * CONFIG.maxSpeed;

      // 计算转向力
      const desired = target.sub(pos);
      const d = desired.length();

      if (d > 0) {
        desired.normalize();
        if (d < 10) desired.multiplyScalar(speed * (d / 10));
        else desired.multiplyScalar(speed);
      }

      const steer = desired.sub(vel);
      steer.clampLength(0, CONFIG.steerForce * delta);
      vel.add(steer);

      // 分离力（剑阵和龙爪模式禁用）
      if (!['SWORD_ARRAY', 'DRAGON_CLAW', 'GREATSWORD'].includes(gestureMode)) {
        if (i > 0) {
          const prev = positions.current[i - 1];
          const diff = pos.clone().sub(prev);
          const dist = diff.length();
          if (dist < CONFIG.separationDist && dist > 0.01) {
            diff.normalize().multiplyScalar(CONFIG.separationForce * delta);
            vel.add(diff);
          }
        }
      }

      // 更新位置
      pos.add(vel.clone().multiplyScalar(delta));

      // 更新矩阵
      dummy.position.copy(pos);

      // 朝向计算
      let lookTarget: THREE.Vector3;
      
      if (gestureMode === 'GREATSWORD') {
        // 大剑模式：沿两指方向
        const dir = new THREE.Vector3(twoFingerDir.x, twoFingerDir.y, twoFingerDir.z);
        lookTarget = pos.clone().add(dir);
      } else if (gestureMode === 'SWORD_ARRAY') {
        // 剑阵：朝外
        const outward = pos.clone().sub(currentTarget).normalize();
        lookTarget = pos.clone().add(outward);
      } else if (gestureMode === 'DRAGON_CLAW') {
        // 龙爪：朝外下方
        const outward = pos.clone().sub(currentTarget);
        outward.y -= 1;
        lookTarget = pos.clone().add(outward.normalize());
      } else if (gestureMode === 'SWORD_CONVERGE') {
        // 剑聚：朝向中心
        lookTarget = currentTarget.clone();
      } else {
        lookTarget = pos.clone().add(vel.length() > 0.1 ? vel : new THREE.Vector3(0, 0, -1));
      }
      
      dummy.lookAt(lookTarget);

      // 平滑缩放
      swordScales.current[i] = THREE.MathUtils.lerp(swordScales.current[i], targetScale, 0.05);
      dummy.scale.setScalar(swordScales.current[i]);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // 更新光环
      if (auraRef.current) {
        const isActive = Math.sin(time * 20 + i * 0.7) > 0.3;
        const auraScale = swordScales.current[i] * (isActive ? 1.3 : 0);

        dummy.scale.setScalar(auraScale);
        dummy.updateMatrix();
        auraRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (auraRef.current) auraRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, CONFIG.swordCount]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={auraRef}
        args={[auraGeometry, auraMaterial, CONFIG.swordCount]}
        frustumCulled={false}
      />
    </group>
  );
}