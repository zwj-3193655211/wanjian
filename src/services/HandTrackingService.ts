// 使用 MediaPipe Hands + 优化手势判定方案
// 本地已有完整模型文件，完全离线运行
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

// 声明全局 Hands 类
declare global {
  interface Window {
    Hands: new (config: { locateFile: (file: string) => string }) => Hands;
  }
}

// 手势防抖
let lastGesture: GestureMode = 'LOTUS';
let gestureCount = 0;
const GESTURE_THRESHOLD = 3; // 连续3帧相同才确认

// 初始化函数
export async function initHandTracking(videoElement: HTMLVideoElement): Promise<boolean> {
  globalVideo = videoElement;

  try {
    console.log('📷 Step 1: 请求摄像头权限...');
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
    });

    videoElement.srcObject = stream;
    
    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= 2) {
        resolve();
        return;
      }
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

    try {
      await videoElement.play();
    } catch (e) {
      console.log('Play warning:', e);
    }
    
    console.log('✅ 摄像头已就绪');

    // Step 2: 加载 MediaPipe Hands - 使用本地文件
    console.log('📦 Step 2: 加载本地手势识别模型...');
    
    // 动态加载脚本
    await loadScript('/models/hands.js');
    
    // 等待 Hands 类可用
    let retries = 0;
    while (!window.Hands && retries < 50) {
      await new Promise(r => setTimeout(r, 100));
      retries++;
    }
    
    if (!window.Hands) {
      throw new Error('Hands class not found after loading script');
    }
    
    // 创建 Hands 实例
    hands = new window.Hands({
      locateFile: (file: string) => {
        console.log('加载文件:', file);
        return `/models/${file}`;
      }
    });
    
    // 优化参数：降低阈值提高检测率
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.3,  // 降低检测阈值
      minTrackingConfidence: 0.3,   // 降低追踪阈值
    });
    
    hands.onResults((results: Results) => {
      latestResults = results;
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        console.log('✋ 检测到手!');
      }
    });
    
    console.log('✅ 手势识别模型加载完成（完全离线）');

    // 启动检测循环
    startDetection();
    
    console.log('✅ 手势识别初始化成功！');
    return true;
  } catch (e) {
    console.error('❌ 初始化失败:', e);
    throw e;
  }
}

// 动态加载脚本
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    if (window.Hands) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      console.log('脚本加载成功:', src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// 检测循环
function startDetection() {
  const detect = async () => {
    if (!hands || !globalVideo || globalVideo.readyState < 2 || isDetecting) {
      requestAnimationFrame(detect);
      return;
    }
    
    isDetecting = true;
    
    try {
      await hands.send({ image: globalVideo });
    } catch (e) {
      console.error('检测错误:', e);
    }
    
    isDetecting = false;
    requestAnimationFrame(detect);
  };
  
  detect();
}

// 获取最新结果
export function getLatestResults(): Results | null {
  return latestResults;
}

// 检测手势类型 - 优化版
export function detectGesture(): GestureMode {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return 'LOTUS'; // 默认5指 -> 莲花阵
  }
  
  const landmarks = latestResults.multiHandLandmarks[0];
  const detected = analyzeGesture(landmarks);
  
  // 防抖：连续相同手势才确认
  if (detected === lastGesture) {
    gestureCount++;
  } else {
    lastGesture = detected;
    gestureCount = 1;
  }
  
  return gestureCount >= GESTURE_THRESHOLD ? detected : lastGesture;
}

// 分析手势 - 基于精确的手指检测
function analyzeGesture(landmarks: Landmark[]): GestureMode {
  // MediaPipe Hands Landmark 索引:
  // 0: 手腕
  // 拇指: 1(CMC), 2(MCP), 3(IP), 4(TIP)
  // 食指: 5(MCP), 6(PIP), 7(DIP), 8(TIP)
  // 中指: 9(MCP), 10(PIP), 11(DIP), 12(TIP)
  // 无名指: 13(MCP), 14(PIP), 15(DIP), 16(TIP)
  // 小指: 17(MCP), 18(PIP), 19(DIP), 20(TIP)

  // 手指伸直判定 - 基于Y坐标比较（指尖Y < PIP关节Y = 伸直）
  const isFingerExtended = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    // 指尖在PIP关节上方
    const isAbovePip = tip.y < pip.y;
    // 指尖在MCP关节上方
    const isAboveMcp = tip.y < mcp.y;
    // Y差异足够大
    const yDiff = pip.y - tip.y;
    const isSignificant = yDiff > 0.02;

    return isAbovePip && isSignificant;
  };

  // 拇指特殊判定 - 基于X坐标差异
  const isThumbExtended = () => {
    const tip = landmarks[4];
    const ip = landmarks[3];

    // 拇指伸直时，指尖远离IP关节
    const xDist = Math.abs(tip.x - ip.x);
    const yDist = Math.abs(tip.y - ip.y);

    return xDist > yDist && xDist > 0.05;
  };

  // 检测每个手指状态
  const thumbExtended = isThumbExtended();
  const indexExtended = isFingerExtended(8, 6, 5);
  const middleExtended = isFingerExtended(12, 10, 9);
  const ringExtended = isFingerExtended(16, 14, 13);
  const pinkyExtended = isFingerExtended(20, 18, 17);

  const extendedCount = [
    thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended
  ].filter(Boolean).length;

  console.log('=== 手指状态 ===', {
    thumb: thumbExtended ? '伸' : '弯',
    index: indexExtended ? '伸' : '弯',
    middle: middleExtended ? '伸' : '弯',
    ring: ringExtended ? '伸' : '弯',
    pinky: pinkyExtended ? '伸' : '弯',
    extendedCount
  });

  // 映射手指数量到阵型
  // 0指 -> 聚拢阵, 1指 -> 游龙阵, 2指 -> 双龙阵, 3指 -> 螺旋阵, 4指 -> 莲花阵, 5指 -> 大庚剑阵
  const gestureMap: GestureMode[] = ['GATHER', 'DRAGON', 'HUNTIAN', 'PHOENIX', 'LOTUS', 'DAGENG'];
  const detected = gestureMap[extendedCount] || 'LOTUS';

  console.log(`>>> ${extendedCount}指 (${detected})`);
  return detected;
}

// 获取所有手部关键点
export function getHandLandmarks(): Array<{ x: number; y: number; z: number }> | null {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return null;
  }
  return latestResults.multiHandLandmarks[0];
}

// 获取手掌中心点
export function getPalmCenter(): { x: number; y: number } | null {
  const landmarks = getHandLandmarks();
  if (!landmarks) return null;
  
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  
  return {
    x: (wrist.x + middleMcp.x) / 2,
    y: (wrist.y + middleMcp.y) / 2,
  };
}

// 清理
export function cleanup() {
  if (hands) {
    hands.close();
  }
  hands = null;
  latestResults = null;
}
