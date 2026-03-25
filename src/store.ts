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
  // 大庚剑阵参数
  dagengRadius: 30,
  dagengHeight: 20,
  dagengRotateSpeed: 0.2,
};

// 配置参数默认值
const DEFAULT_CONFIG = {
  swordCount: isMobile ? 200 : 300,
  maxSpeed: 50,
  sprintSpeed: 80,
  steerForce: 40,
};

// 配置状态
interface ConfigState {
  swordCount: number;
  maxSpeed: number;
  sprintSpeed: number;
  steerForce: number;
}

// 手势模式
export type GestureMode = 'GATHER' | 'DRAGON' | 'HUNTIAN' | 'PHOENIX' | 'DAGENG' | 'LOTUS';

// 阵型元数据
export const FORMATION_META: Record<GestureMode, { name: string; emoji: string; color: string }> = {
  GATHER: { name: '聚拢阵', emoji: '🛡️', color: '#88ccff' },
  DRAGON: { name: '游龙阵', emoji: '🐉', color: '#00ff88' },
  HUNTIAN: { name: '浑天阵', emoji: '🌌', color: '#44ffaa' },
  PHOENIX: { name: '凤凰阵', emoji: '🔥', color: '#ff4444' },
  DAGENG: { name: '大庚剑阵', emoji: '⚔️', color: '#ffd700' },
  LOTUS: { name: '莲花阵', emoji: '🌸', color: '#ffaa44' },
};

interface HandState {
  targetPosition: THREE.Vector3;
  isTracking: boolean;
  gestureMode: GestureMode;
  pathHistory: THREE.Vector3[];
  lastDirection: THREE.Vector3;
  config: ConfigState;
  useMouse: boolean;
  mousePosition: THREE.Vector3;

  setTarget: (pos: THREE.Vector3) => void;
  setTracking: (tracking: boolean) => void;
  setGestureMode: (mode: GestureMode) => void;
  updatePath: (pos: THREE.Vector3) => void;
  extendPath: () => void;
  setConfig: (updates: Partial<ConfigState>) => void;
  resetConfig: () => void;
  setUseMouse: (useMouse: boolean) => void;
  setMousePosition: (pos: THREE.Vector3) => void;
  cycleGestureMode: () => void;
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
  config: { ...DEFAULT_CONFIG },
  useMouse: false,
  mousePosition: new THREE.Vector3(0, 0, 0),

  setTarget: (pos) => set({ targetPosition: pos }),

  setTracking: (tracking) => set({ isTracking: tracking }),

  setGestureMode: (mode) => set({ gestureMode: mode }),

  setConfig: (updates) => set((state) => ({
    config: { ...state.config, ...updates }
  })),

  resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),

  setUseMouse: (useMouse) => set({ useMouse }),

  setMousePosition: (pos) => set({ mousePosition: pos }),

  cycleGestureMode: () => {
    const currentMode = get().gestureMode;
    const modes: GestureMode[] = ['GATHER', 'DRAGON', 'HUNTIAN', 'PHOENIX', 'LOTUS', 'DAGENG'];
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    set({ gestureMode: modes[nextIndex] });
  },

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
