import { create } from 'zustand';
import * as THREE from 'three';

// 配置参数
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
) || window.innerWidth < 768;

export const CONFIG = {
  swordCount: isMobile ? 200 : 300,
  pathHistoryLength: 300,
  maxSpeed: 50,
  sprintSpeed: 80,
  steerForce: 40,
  separationDist: 3,
  separationForce: 10,
  noiseScale: 0.3,
  noiseStrength: 1.5,
  formationRadius: 1.5,
  dragonDensity: 0.8,
  shieldRadius: 18,
  shieldOrbitSpeed: 3.5,
  lotusRadius: 24,
  lotusRotateSpeed: 3.5,
  // 剑阵参数（大庚剑阵）
  swordArrayRadius: 30,
  swordArrayHeight: 20,
  swordArrayRotateSpeed: 0.2,
};

// 6种手势模式
export type GestureMode = 
  | 'SWORD_CONVERGE'  // 0指 - 剑聚
  | 'DRAGON'          // 1指 - 游龙
  | 'GREATSWORD'      // 2指 - 大剑
  | 'SWORD_ARRAY'     // 3指 - 剑阵
  | 'SWORD_SCATTER'   // 4指 - 剑散
  | 'DRAGON_CLAW';    // 5指 - 龙爪

interface HandState {
  targetPosition: THREE.Vector3;
  isTracking: boolean;
  gestureMode: GestureMode;
  fingerCount: number;
  handRotation: { yaw: number; pitch: number; roll: number };
  twoFingerDirection: { x: number; y: number; z: number };
  pathHistory: THREE.Vector3[];
  lastDirection: THREE.Vector3;
  trajectoryPoints: THREE.Vector3[]; // 白点轨迹

  setTarget: (pos: THREE.Vector3) => void;
  setTracking: (tracking: boolean) => void;
  setGestureMode: (mode: GestureMode) => void;
  setFingerCount: (count: number) => void;
  setHandRotation: (rot: { yaw: number; pitch: number; roll: number }) => void;
  setTwoFingerDirection: (dir: { x: number; y: number; z: number }) => void;
  updatePath: (pos: THREE.Vector3) => void;
  extendPath: () => void;
  addTrajectoryPoint: (pos: THREE.Vector3) => void;
}

export const useHandStore = create<HandState>((set, get) => ({
  targetPosition: new THREE.Vector3(0, 0, 0),
  isTracking: false,
  gestureMode: 'SWORD_SCATTER',
  fingerCount: -1,
  handRotation: { yaw: 0, pitch: 0, roll: 0 },
  twoFingerDirection: { x: 0, y: 1, z: 0 },
  pathHistory: Array.from({ length: CONFIG.pathHistoryLength }, () => new THREE.Vector3(0, 0, 0)),
  lastDirection: new THREE.Vector3(0, 0, 0),
  trajectoryPoints: [],

  setTarget: (pos) => set({ targetPosition: pos }),
  setTracking: (tracking) => set({ isTracking: tracking }),
  setGestureMode: (mode) => set({ gestureMode: mode }),
  setFingerCount: (count) => set({ fingerCount: count }),
  setHandRotation: (rot) => set({ handRotation: rot }),
  setTwoFingerDirection: (dir) => set({ twoFingerDirection: dir }),
  
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
    const newPoint = last.clone().add(lastDirection.clone().multiplyScalar(0.3));
    pathHistory.pop();
    pathHistory.unshift(newPoint);
  },

  addTrajectoryPoint: (pos) => {
    const { trajectoryPoints } = get();
    const newPoints = [...trajectoryPoints, pos.clone()];
    // 保留最近100个点
    if (newPoints.length > 100) newPoints.shift();
    set({ trajectoryPoints: newPoints });
  },
}));
