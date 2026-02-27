// MediaPipe Hands 手势识别服务
// 支持手指计数（0-5）和手部旋转追踪
import type { GestureMode } from '../store';

// 全局状态
export let globalVideo: HTMLVideoElement | null = null;
export let latestResults: Results | null = null;
let hands: Hands | null = null;
let isDetecting = false;

// 类型定义
interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface Results {
  multiHandLandmarks?: Landmark[][];
  multiHandedness?: Array<{ label: string; score: number }>;
}

interface Hands {
  setOptions(options: HandsOptions): void;
  onResults(callback: (results: Results) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

interface HandsOptions {
  maxNumHands?: number;
  modelComplexity?: 0 | 1;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

declare global {
  interface Window {
    Hands: new (config: { locateFile: (file: string) => string }) => Hands;
  }
}

// 手势防抖
let lastGesture: GestureMode = 'SWORD_SCATTER';
let gestureCount = 0;
const GESTURE_THRESHOLD = 3;

// 初始化
export async function initHandTracking(videoElement: HTMLVideoElement): Promise<boolean> {
  globalVideo = videoElement;

  try {
    console.log('📷 Step 1: 请求摄像头权限...');
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });

    videoElement.srcObject = stream;
    
    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= 2) { resolve(); return; }
      const onReady = () => {
        videoElement.removeEventListener('loadeddata', onReady);
        videoElement.removeEventListener('canplay', onReady);
        videoElement.removeEventListener('playing', onReady);
        resolve();
      };
      videoElement.addEventListener('loadeddata', onReady);
      videoElement.addEventListener('canplay', onReady);
      videoElement.addEventListener('playing', onReady);
      setTimeout(onReady, 500);
    });

    try { await videoElement.play(); } catch (e) { console.log('Play warning:', e); }
    console.log('✅ 摄像头已就绪');

    console.log('📦 Step 2: 加载手势识别模型...');
    await loadScript('/models/hands.js');
    
    let retries = 0;
    while (!window.Hands && retries < 50) {
      await new Promise(r => setTimeout(r, 100));
      retries++;
    }
    
    if (!window.Hands) throw new Error('Hands class not found');
    
    hands = new window.Hands({
      locateFile: (file: string) => `/models/${file}`
    });
    
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
    
    hands.onResults((results: Results) => {
      latestResults = results;
    });
    
    console.log('✅ 手势识别模型加载完成');
    startDetection();
    
    return true;
  } catch (e) {
    console.error('❌ 初始化失败:', e);
    throw e;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Hands) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });
}

function startDetection() {
  const detect = async () => {
    if (!hands || !globalVideo || globalVideo.readyState < 2 || isDetecting) {
      requestAnimationFrame(detect);
      return;
    }
    isDetecting = true;
    try { await hands.send({ image: globalVideo }); } catch (e) { console.error('检测错误:', e); }
    isDetecting = false;
    requestAnimationFrame(detect);
  };
  detect();
}

export function getLatestResults(): Results | null {
  return latestResults;
}

// 获取手指伸直数量（0-5）
export function getFingerCount(): number {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return -1; // 未检测到手
  }
  
  const landmarks = latestResults.multiHandLandmarks[0];
  
  // 手指弯曲判定
  const isFingerCurled = (mcpIdx: number, pipIdx: number, tipIdx: number) => {
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];
    
    const boneLength = Math.hypot(pip.x - mcp.x, pip.y - mcp.y) + 
                       Math.hypot(tip.x - pip.x, tip.y - pip.y);
    const tipToMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
    const ratio = tipToMcp / boneLength;
    const isTipBelowPip = tip.y > pip.y + 0.02;
    
    return !(ratio > 0.75 && !isTipBelowPip);
  };
  
  // 拇指判定
  const isThumbCurled = () => {
    const tip = landmarks[4];
    const indexMcp = landmarks[5];
    return Math.hypot(tip.x - indexMcp.x, tip.y - indexMcp.y) < 0.12;
  };
  
  const thumbExtended = !isThumbCurled();
  const indexExtended = !isFingerCurled(5, 6, 8);
  const middleExtended = !isFingerCurled(9, 10, 12);
  const ringExtended = !isFingerCurled(13, 14, 16);
  const pinkyExtended = !isFingerCurled(17, 18, 20);
  
  let count = 0;
  if (thumbExtended) count++;
  if (indexExtended) count++;
  if (middleExtended) count++;
  if (ringExtended) count++;
  if (pinkyExtended) count++;
  
  return count;
}

// 根据手指数量返回手势模式
export function detectGesture(): GestureMode {
  const fingerCount = getFingerCount();
  
  if (fingerCount < 0) return 'SWORD_SCATTER';
  
  // 防抖
  let detected: GestureMode;
  switch (fingerCount) {
    case 0: detected = 'SWORD_CONVERGE'; break;  // 握拳 - 剑聚
    case 1: detected = 'DRAGON'; break;           // 剑指 - 游龙
    case 2: detected = 'GREATSWORD'; break;       // 两指 - 大剑
    case 3: detected = 'SWORD_ARRAY'; break;      // 三指 - 剑阵
    case 4: detected = 'SWORD_SCATTER'; break;    // 四指 - 剑散
    case 5: detected = 'DRAGON_CLAW'; break;      // 张掌 - 龙爪
    default: detected = 'SWORD_SCATTER';
  }
  
  if (detected === lastGesture) {
    gestureCount++;
  } else {
    lastGesture = detected;
    gestureCount = 1;
  }
  
  console.log(`👆 手指: ${fingerCount} → ${detected}`);
  
  return gestureCount >= GESTURE_THRESHOLD ? detected : lastGesture;
}

// 获取手部旋转角度（用于大剑挥动）
export function getHandRotation(): { yaw: number; pitch: number; roll: number } {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
  
  const landmarks = latestResults.multiHandLandmarks[0];
  
  // 使用手腕(0)、食指MCP(5)、小指MCP(17)计算手部朝向
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  const middleMcp = landmarks[9];
  
  // 手掌中心到手腕的方向（俯仰角）
  const palmCenter = {
    x: (wrist.x + indexMcp.x + pinkyMcp.x) / 3,
    y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3,
  };
  
  // Yaw: 左右旋转（基于食指和小指MCP的连线）
  const yaw = Math.atan2(pinkyMcp.x - indexMcp.x, pinkyMcp.z - indexMcp.z);
  
  // Pitch: 上下倾斜（基于手腕到中指MCP的方向）
  const pitch = Math.atan2(middleMcp.y - wrist.y, middleMcp.z - wrist.z);
  
  // Roll: 手掌翻转（基于食指MCP到小指MCP的连线角度）
  const roll = Math.atan2(indexMcp.y - pinkyMcp.y, indexMcp.x - pinkyMcp.x);
  
  return { yaw, pitch, roll };
}

// 获取两指方向（用于大剑朝向）
export function getTwoFingerDirection(): { x: number; y: number; z: number } {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return { x: 0, y: 1, z: 0 };
  }
  
  const landmarks = latestResults.multiHandLandmarks[0];
  
  // 食指尖(8) 和 中指尖(12) 的中点
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const wrist = landmarks[0];
  
  // 方向：从手腕指向两指尖中点
  const tipMid = {
    x: (indexTip.x + middleTip.x) / 2,
    y: (indexTip.y + middleTip.y) / 2,
    z: (indexTip.z + middleTip.z) / 2,
  };
  
  const dir = {
    x: tipMid.x - wrist.x,
    y: tipMid.y - wrist.y,
    z: tipMid.z - wrist.z,
  };
  
  // 归一化
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len > 0.001) {
    dir.x /= len;
    dir.y /= len;
    dir.z /= len;
  }
  
  return dir;
}

// 获取手部关键点
export function getHandLandmarks(): Array<{ x: number; y: number; z: number }> | null {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return null;
  }
  return latestResults.multiHandLandmarks[0];
}

// 获取手掌中心
export function getPalmCenter(): { x: number; y: number } | null {
  const landmarks = getHandLandmarks();
  if (!landmarks) return null;
  return {
    x: (landmarks[0].x + landmarks[9].x) / 2,
    y: (landmarks[0].y + landmarks[9].y) / 2,
  };
}

// 清理
export function cleanup() {
  if (hands) hands.close();
  hands = null;
  latestResults = null;
}