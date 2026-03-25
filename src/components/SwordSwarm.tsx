import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useHandStore, CONFIG } from '../store';
import type { GestureMode } from '../store';

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

// 共享 positions 给 DivineLightning
declare global {
  interface Window {
    swordPositions?: THREE.Vector3[];
  }
}

export function SwordSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 物理状态 - 使用最大容量
  const MAX_SWORDS = 500;
  const positions = useRef<THREE.Vector3[]>([]);
  const velocities = useRef<THREE.Vector3[]>([]);

  // 初始化 - 使用最大容量
  if (positions.current.length === 0) {
    for (let i = 0; i < MAX_SWORDS; i++) {
      positions.current.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 10 - 5
        )
      );
      velocities.current.push(new THREE.Vector3());
    }
    window.swordPositions = positions.current;
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

    const targetPosition = useHandStore.getState().targetPosition;
    const isTracking = useHandStore.getState().isTracking;
    const gestureMode = useHandStore.getState().gestureMode;
    const pathHistory = useHandStore.getState().pathHistory;
    const lastDirection = useHandStore.getState().lastDirection;
    const extendPath = useHandStore.getState().extendPath;
    const updatePath = useHandStore.getState().updatePath;
    const config = useHandStore.getState().config;
    const mousePosition = useHandStore.getState().mousePosition;

    const time = clock.getElapsedTime();
    const delta = 1 / 60;

    // 无手势时跟随鼠标，有手势时跟随手
    let currentTarget = isTracking ? targetPosition : mousePosition;

    if (isTracking && gestureMode === 'DRAGON') {
      extendPath();
    } else if (!isTracking) {
      // 鼠标模式：更新路径历史用于游龙阵
      updatePath(currentTarget);
    }

    // 根据阵型更新剑的颜色
    const formationColors = {
      GATHER: 0x88ccff,
      DRAGON: 0x00ff88,
      HUNTIAN: 0x44ffaa,
      PHOENIX: 0xffaa44,
      DAGENG: 0xffd700,  // 金色
      LOTUS: 0xffaa44,
    };
    (meshRef.current.material as THREE.MeshBasicMaterial).color.setHex(formationColors[gestureMode]);

    // 根据模式计算目标
    for (let i = 0; i < config.swordCount; i++) {
      const pos = positions.current[i];
      const vel = velocities.current[i];
      const target = new THREE.Vector3();

      if (gestureMode === 'GATHER' && isTracking) {
        // 聚拢阵：球形轨道（复用SHIELD逻辑）
        const phi = Math.acos(1 - (2 * (i + 0.5)) / config.swordCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        const orbitX =
          CONFIG.shieldRadius *
          Math.sin(phi) *
          Math.cos(theta + time * CONFIG.shieldOrbitSpeed);
        const orbitY =
          CONFIG.shieldRadius *
          Math.sin(phi) *
          Math.sin(theta + time * CONFIG.shieldOrbitSpeed);
        const orbitZ = CONFIG.shieldRadius * Math.cos(phi);

        const rotatedX =
          orbitX * Math.cos(time * 0.3) - orbitZ * Math.sin(time * 0.3);
        const rotatedZ =
          orbitX * Math.sin(time * 0.3) + orbitZ * Math.cos(time * 0.3);

        target.set(
          currentTarget.x + rotatedX,
          currentTarget.y + orbitY,
          currentTarget.z + rotatedZ
        );

        target.x += Math.sin(time * 3 + i) * 0.2;
        target.y += Math.cos(time * 3 + i * 0.7) * 0.2;
      } else if (gestureMode === 'HUNTIAN') {
        // 双龙阵 - 围绕白点画圆
        const radius = 5;
        const speed = 2;

        // 每把剑有固定角度偏移，形成圆环
        const offset = (i / config.swordCount) * Math.PI * 2;
        const angle = time * speed + offset;

        target.set(
          currentTarget.x + Math.cos(angle) * radius,
          currentTarget.y + Math.sin(angle) * radius,
          currentTarget.z
        );
      } else if (gestureMode === 'PHOENIX') {
        // 凤凰阵 - 双圆环形成明显的∞符号
        // 飞剑分成两组，分别在上圆和下圆运动
        const circleRadius = 7;  // 圆半径
        const circleDistance = 6;  // 两个圆心的垂直距离
        const speed = 2.5;  // 旋转速度

        // 奇数剑在上圆，偶数剑在下圆
        const isTopCircle = i % 2 === 0;

        // 每个圆内的角度位置（让剑均匀分布在圆周上）
        const swordsPerCircle = Math.ceil(config.swordCount / 2);
        const posInCircle = Math.floor(i / 2);
        const angle = time * speed + (posInCircle / swordsPerCircle) * Math.PI * 2;

        // 计算圆心位置
        const circleCenterY = isTopCircle ? circleDistance / 2 : -circleDistance / 2;

        // 圆周运动
        const x = Math.cos(angle) * circleRadius;
        const y = circleCenterY + Math.sin(angle) * circleRadius;

        target.set(
          currentTarget.x + x,
          currentTarget.y + y,
          currentTarget.z
        );
      } else if (gestureMode === 'DAGENG') {
        // 大庚剑阵 - 原始效果
        if (i === 0) {
          // 主剑：悬浮在手心上方
          const centralHeight = currentTarget.y + 5;
          target.set(currentTarget.x, centralHeight, currentTarget.z);
        } else {
          // 其他剑：分层旋转
          const effectiveI = i - 1;
          const effectiveCount = config.swordCount - 1;

          const layerCount = 10;
          const perLayer = Math.max(1, Math.floor(effectiveCount / layerCount));
          const layerIdx = Math.floor(effectiveI / perLayer);
          const idxInLayer = effectiveI % perLayer;

          // 半径从内向外递增
          const radius = CONFIG.dagengRadius + layerIdx * 1.5 + 2;

          // 奇偶层旋转方向相反
          const dir = layerIdx % 2 === 0 ? 1 : -1;
          const theta =
            (idxInLayer / perLayer) * Math.PI * 2 +
            time * CONFIG.dagengRotateSpeed * dir;

          // 高度随机分布
          const hCenter = currentTarget.y - 10;
          const hRange = CONFIG.dagengHeight;
          const hRand = Math.sin(effectiveI * 13.1) * 0.5 + 0.5;
          const height = hCenter + (hRand - 0.5) * hRange;

          target.set(
            currentTarget.x + Math.cos(theta) * radius,
            height,
            currentTarget.z + Math.sin(theta) * radius
          );
        }
      } else if (gestureMode === 'LOTUS') {
        // 莲花模式：斐波那契螺旋（增强版）
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const maxRadius = CONFIG.lotusRadius + 6;  // 增大最大半径
        const minRadius = 4;

        const t = i / (config.swordCount - 1);
        const rRatio = Math.sqrt(t);
        const r = minRadius + (maxRadius - minRadius) * rRatio;

        const theta = i * goldenAngle + time * CONFIG.lotusRotateSpeed * 1.5;  // 加快旋转

        // 增强呼吸效果和波浪运动
        const breathe = 1 + Math.sin(time * 3 + i * 0.05) * 0.15;  // 更明显的呼吸
        const wave = Math.sin(time * 4 + i * 0.1) * 1.5;  // 添加波浪效果
        const currentR = r * breathe + wave;

        const x = currentR * Math.cos(theta);
        const y = currentR * Math.sin(theta);
        const z = Math.sin(time * 3 + i * 0.15) * 1.5;  // 增强Z轴波动

        target.set(
          currentTarget.x + x,
          currentTarget.y + y,
          currentTarget.z + z
        );
      } else {
        // 游龙模式
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
          } else if (pathHistory[idxA]) {
            target.copy(pathHistory[idxA]);
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
      }

      // 动态速度
      let speed = gestureMode === 'GATHER' ? config.sprintSpeed : config.maxSpeed;
      if (target.distanceTo(pos) > 4) speed = config.sprintSpeed;
      else if (target.distanceTo(pos) < 1)
        speed = target.distanceTo(pos) * config.maxSpeed;

      // 计算转向力
      const desired = target.sub(pos);
      const d = desired.length();

      if (d > 0) {
        desired.normalize();
        if (d < 10) {
          desired.multiplyScalar(speed * (d / 10));
        } else {
          desired.multiplyScalar(speed);
        }
      }

      const steer = desired.sub(vel);
      // 双龙阵也使用高转向力，让飞剑更快跟随圆周轨迹
      const steerFactor = gestureMode === 'GATHER' || gestureMode === 'LOTUS' || gestureMode === 'HUNTIAN' ? 3 : 1;
      steer.clampLength(0, config.steerForce * delta * steerFactor);

      vel.add(steer);

      // 分离力 - 双龙阵禁用分离力，保持圆周运动
      if (i > 0 && gestureMode !== 'GATHER' && gestureMode !== 'HUNTIAN' && (gestureMode !== 'LOTUS' || !isTracking)) {
        const prev = positions.current[i - 1];
        const diff = pos.clone().sub(prev);
        const d = diff.length();
        if (d < CONFIG.separationDist && d > 0.01) {
          diff.normalize().multiplyScalar(CONFIG.separationForce * delta);
          vel.add(diff);
        }
      }

      // 更新位置
      pos.add(vel.clone().multiplyScalar(delta));

      // 更新矩阵
      dummy.position.copy(pos);

      // 朝向
      let lookTarget: THREE.Vector3;
      if (gestureMode === 'GATHER' && isTracking) {
        if (vel.length() > 0.1) {
          lookTarget = pos.clone().add(vel.clone().normalize());
        } else {
          const relPos = pos.clone().sub(currentTarget);
          const tangent = new THREE.Vector3(-relPos.z, 0, relPos.x).normalize();
          lookTarget = pos.clone().add(tangent);
        }
      } else if (gestureMode === 'LOTUS') {
        const outward = pos.clone().sub(currentTarget).normalize();
        lookTarget = pos.clone().add(outward);
      } else if (gestureMode === 'DAGENG' && isTracking) {
        // 大庚剑阵：剑朝向下方
        lookTarget = pos.clone().add(new THREE.Vector3(0, -1, 0));
      } else {
        lookTarget = pos
          .clone()
          .add(vel.length() > 0.1 ? vel : new THREE.Vector3(0, 0, -1));
      }
      dummy.lookAt(lookTarget);

      // 大庚模式下剑体变大
      let targetScale = 1;
      if (gestureMode === 'DAGENG' && isTracking) {
        if (i === 0) targetScale = 6;  // 主剑放大6倍
        else targetScale = 1.5;        // 其他剑放大1.5倍
      }

      const currentScale = meshRef.current.userData.currentScale || 1;
      const lerpSpeed = (i === 0 && gestureMode === 'DAGENG') ? 0.01 : 0.02;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, lerpSpeed);

      meshRef.current.userData.currentScale = newScale;

      dummy.scale.set(newScale, newScale, newScale);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // 更新光环
      if (auraRef.current) {
        const isActive =
          gestureMode === 'GATHER'
            ? Math.sin(time * 30 + i * 0.5) > 0.0
            : Math.sin(time * 20 + i * 0.7) > 0.3;

        const auraScale = newScale * (isActive ? 1.3 : 1.0);

        // 大庚剑阵的主剑也显示光环
        if (!isActive && !(i === 0 && gestureMode === 'DAGENG')) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(auraScale, auraScale, auraScale);
        }

        dummy.updateMatrix();
        auraRef.current.setMatrixAt(i, dummy.matrix);
        dummy.scale.set(newScale, newScale, newScale);
      }
    }

    // 隐藏多余的飞剑（超过配置数量）
    for (let i = config.swordCount; i < MAX_SWORDS; i++) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (auraRef.current) {
        auraRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (auraRef.current) {
      auraRef.current.instanceMatrix.needsUpdate = true;
      // 更新光环颜色
      const auraColors = {
        GATHER: 0x88ccff,
        DRAGON: 0x00ff88,
        HUNTIAN: 0x44ffaa,
        PHOENIX: 0xffaa44,
        DAGENG: 0xffd700,  // 金色光环
        LOTUS: 0xffaa44,
      };
      (auraRef.current.material as THREE.MeshBasicMaterial).color.setHex(auraColors[gestureMode]);
    }
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, MAX_SWORDS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={auraRef}
        args={[auraGeometry, auraMaterial, MAX_SWORDS]}
        frustumCulled={false}
      />
    </group>
  );
}
