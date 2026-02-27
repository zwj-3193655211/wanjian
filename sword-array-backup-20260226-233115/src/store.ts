import { create } from 'zustand';
import * as THREE from 'three';

// =========== 配置参数 ===========
// 简单的移动端检测
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;

export const CONFIG = {
  swordCount: isMobile ? 200 : 300,
  pathHistoryLength: 300,
  maxSpeed: 50,      // 游龙模式最大速度提升
  sprintSpeed: 80,   // 冲刺速度提升
  steerForce: 40,    // 转向力提升
  separationDist: 3,
  separationForce: 10,
  noiseScale: 0.3,
  noiseStrength: 1.5, // 噪声强度提升
  formationRadius: 1.5,
  dragonDensity: 0.8,
  // 护盾模式参数
  shieldRadius: 18,
  shieldOrbitSpeed: 3.5, // 护盾旋转加速
  // 莲花模式参数
  lotusRadius: 24,
  lotusRotateSpeed: 3.5, // 莲花旋转加速
};

// 手势模式
export type GestureMode = 'DRAGON' | 'SHIELD' | 'LOTUS';

interface HandState {
  targetPosition: THREE.Vector3;
  isTracking: boolean;
  gestureMode: GestureMode;
  pathHistory: THREE.Vector3[];
  lastDirection: THREE.Vector3;

  setTarget: (pos: THREE.Vector3) => void;
  setTracking: (tracking: boolean) => void;
  setGestureMode: (mode: GestureMode) => void;
  updatePath: (pos: THREE.Vector3) => void;
  extendPath: () => void;
}

export const useHandStore = create<HandState>((set, get) => ({
  targetPosition: new THREE.Vector3(0, 0, 0),
  isTracking: false,
  gestureMode: 'LOTUS',
  pathHistory: Array.from(
    { length: CONFIG.pathHistoryLength },
    () => new THREE.Vector3(0, 0, 0)
  ),
  lastDirection: new THREE.Vector3(0, 0, 0),

  setTarget: (pos) => set({ targetPosition: pos }),

  setTracking: (tracking) => set({ isTracking: tracking }),

  setGestureMode: (mode) => set({ gestureMode: mode }),

  updatePath: (pos) => {
    const { pathHistory, lastDirection } = get();
    const last = pathHistory[0];
    const diff = pos.clone().sub(last);
    const dist = diff.length();

    if (dist > 0.1) {
      lastDirection.copy(diff.normalize());
      pathHistory.pop();
      pathHistory.unshift(pos.clone());
    }
  },

  extendPath: () => {
    const { pathHistory, lastDirection } = get();
    if (lastDirection.length() < 0.01) return;

    const last = pathHistory[0];
    const newPoint = last
      .clone()
      .add(lastDirection.clone().multiplyScalar(0.3));
    pathHistory.pop();
    pathHistory.unshift(newPoint);
  },
}));
