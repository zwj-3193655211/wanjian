import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';
import { 
  globalVideo, 
  getLatestResults,
  detectGesture,
  getHandLandmarks
} from '../services/HandTrackingService';
import type { GestureMode } from '../store';

// 防抖状态
let pendingGesture: GestureMode | null = null;
let gestureStartTime = 0;
let currentConfirmedGesture: GestureMode = 'LOTUS';

export function HandController() {
  const { camera } = useThree();
  const setTarget = useHandStore((state) => state.setTarget);
  const setTracking = useHandStore((state) => state.setTracking);
  const setGestureMode = useHandStore((state) => state.setGestureMode);
  const updatePath = useHandStore((state) => state.updatePath);
  
  const lastDetectedTime = useRef(0);

  useFrame(({ clock }) => {
    if (!globalVideo || globalVideo.readyState < 2) return;
    
    // 获取最新检测结果
    const results = getLatestResults();
    const landmarks = getHandLandmarks();
    if (!results || !landmarks || landmarks.length === 0) {
      const timeSinceLastDetected = clock.getElapsedTime() - lastDetectedTime.current;
      if (timeSinceLastDetected > 0.5) {
        setTracking(false);
      }
      return;
    }

    // 检测到手了
    setTracking(true);
    lastDetectedTime.current = clock.getElapsedTime();
    
    // 检测手势
    const detectedGesture = detectGesture();

    // 防抖逻辑
    const now = clock.getElapsedTime();
    if (detectedGesture !== pendingGesture) {
      pendingGesture = detectedGesture;
      gestureStartTime = now;
    } else {
      const duration = now - gestureStartTime;
      if (duration > 0.15 && detectedGesture !== currentConfirmedGesture) {
        currentConfirmedGesture = detectedGesture;
        setGestureMode(detectedGesture);
      }
    }

    const activeGesture = currentConfirmedGesture;

    // 获取目标位置
    let targetPoint: { x: number; y: number };
    
    // 关键点索引:
    // 0: 手腕, 8: 食指尖, 12: 中指尖
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    
    if (activeGesture === 'SHIELD' || activeGesture === 'LOTUS') {
      // 手掌中心
      if (wrist && middleTip) {
        targetPoint = {
          x: (wrist.x + middleTip.x) / 2,
          y: (wrist.y + middleTip.y) / 2,
        };
      } else {
        targetPoint = { x: 0.5, y: 0.5 };
      }
    } else {
      // 食指指尖
      if (indexTip) {
        targetPoint = { x: indexTip.x, y: indexTip.y };
      } else {
        targetPoint = { x: 0.5, y: 0.5 };
      }
    }

    // landmarks 已经是归一化坐标 (0-1)
    const normalizedX = targetPoint.x;
    const normalizedY = targetPoint.y;
    
    // 转换到3D坐标（镜像翻转）
    const ndcX = (1 - normalizedX) * 2 - 1;
    const ndcY = -(normalizedY * 2 - 1);

    const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    const worldPos = camera.position.clone().add(dir.multiplyScalar(dist));

    setTarget(worldPos);

    // 游龙模式下更新路径
    if (activeGesture === 'DRAGON') {
      updatePath(worldPos);
    }
  });

  return null;
}
