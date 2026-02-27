import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';
import { 
  globalVideo, 
  getLatestResults,
  detectGesture,
  getHandLandmarks,
  getHandRotation,
  getTwoFingerDirection,
  getFingerCount
} from '../services/HandTrackingService';
import type { GestureMode } from '../store';

// 防抖状态
let pendingGesture: GestureMode | null = null;
let gestureStartTime = 0;
let currentConfirmedGesture: GestureMode = 'SWORD_SCATTER';

export function HandController() {
  const { camera } = useThree();
  const setTarget = useHandStore((state) => state.setTarget);
  const setTracking = useHandStore((state) => state.setTracking);
  const setGestureMode = useHandStore((state) => state.setGestureMode);
  const setFingerCount = useHandStore((state) => state.setFingerCount);
  const setHandRotation = useHandStore((state) => state.setHandRotation);
  const setTwoFingerDirection = useHandStore((state) => state.setTwoFingerDirection);
  const updatePath = useHandStore((state) => state.updatePath);
  const addTrajectoryPoint = useHandStore((state) => state.addTrajectoryPoint);
  
  const lastDetectedTime = useRef(0);

  useFrame(({ clock }) => {
    if (!globalVideo || globalVideo.readyState < 2) return;
    
    const results = getLatestResults();
    const landmarks = getHandLandmarks();
    if (!results || !landmarks || landmarks.length === 0) {
      const timeSinceLastDetected = clock.getElapsedTime() - lastDetectedTime.current;
      if (timeSinceLastDetected > 0.5) {
        setTracking(false);
      }
      return;
    }

    setTracking(true);
    lastDetectedTime.current = clock.getElapsedTime();
    
    // 检测手势和手指数量
    const detectedGesture = detectGesture();
    const fingerCount = getFingerCount();
    setFingerCount(fingerCount);
    
    // 获取手部旋转（用于大剑模式）
    const handRotation = getHandRotation();
    setHandRotation(handRotation);
    
    // 获取两指方向（用于大剑朝向）
    const twoFingerDir = getTwoFingerDirection();
    setTwoFingerDirection(twoFingerDir);

    // 防抖逻辑
    const now = clock.getElapsedTime();
    if (detectedGesture !== pendingGesture) {
      pendingGesture = detectedGesture;
      gestureStartTime = now;
    } else {
      const duration = now - gestureStartTime;
      if (duration > 0.1 && detectedGesture !== currentConfirmedGesture) {
        currentConfirmedGesture = detectedGesture;
        setGestureMode(detectedGesture);
      }
    }

    const activeGesture = currentConfirmedGesture;

    // 获取目标位置 - 根据手势选择不同的追踪点
    let targetPoint: { x: number; y: number };
    
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    
    switch (activeGesture) {
      case 'SWORD_CONVERGE':
      case 'DRAGON_CLAW':
        // 手掌中心
        targetPoint = {
          x: (wrist.x + middleTip.x) / 2,
          y: (wrist.y + middleTip.y) / 2,
        };
        break;
      case 'GREATSWORD':
        // 两指尖中点
        targetPoint = {
          x: (indexTip.x + middleTip.x) / 2,
          y: (indexTip.y + middleTip.y) / 2,
        };
        break;
      case 'DRAGON':
      case 'SWORD_ARRAY':
      case 'SWORD_SCATTER':
      default:
        // 食指指尖
        targetPoint = { x: indexTip.x, y: indexTip.y };
    }

    // 转换到3D坐标（镜像翻转）
    const ndcX = (1 - targetPoint.x) * 2 - 1;
    const ndcY = -(targetPoint.y * 2 - 1);

    const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    const worldPos = camera.position.clone().add(dir.multiplyScalar(dist));

    setTarget(worldPos);

    // 游龙和大剑模式下更新路径和轨迹
    if (activeGesture === 'DRAGON' || activeGesture === 'GREATSWORD') {
      updatePath(worldPos);
      addTrajectoryPoint(worldPos);
    }
  });

  return null;
}