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
    return 'LOTUS';
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

// 分析手势 - 简化可靠版
function analyzeGesture(landmarks: Landmark[]): GestureMode {
  // 关键点索引:
  // 0: 手腕
  // 1-4: 拇指 (CMC, MCP, IP, TIP)
  // 5-8: 食指 (MCP, PIP, DIP, TIP)
  // 9-12: 中指 (MCP, PIP, DIP, TIP)
  // 13-16: 无名指 (MCP, PIP, DIP, TIP)
  // 17-20: 小指 (MCP, PIP, DIP, TIP)
  
  // 手指弯曲判定 - 使用指尖到MCP的距离与手指总长度的比值
  // 弯曲时指尖会靠近MCP，伸直时指尖远离MCP
  const isFingerCurled = (mcpIdx: number, pipIdx: number, tipIdx: number) => {
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];
    
    // 计算手指骨架长度 (MCP到PIP + PIP到TIP)
    const boneLength = Math.hypot(pip.x - mcp.x, pip.y - mcp.y) + 
                       Math.hypot(tip.x - pip.x, tip.y - pip.y);
    
    // 计算指尖到MCP的实际距离
    const tipToMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
    
    // 比值：弯曲时 < 0.7，伸直时 > 0.85
    const ratio = tipToMcp / boneLength;
    
    // 额外检查：指尖是否在PIP下方（弯曲状态）
    const isTipBelowPip = tip.y > pip.y + 0.02;
    
    // 伸直判定
    const isExtended = ratio > 0.75 && !isTipBelowPip;
    
    return !isExtended; // 返回是否弯曲
  };
  
  // 拇指特殊处理
  const isThumbCurled = () => {
    const tip = landmarks[4];
    const ip = landmarks[3];
    const mcp = landmarks[2];
    const indexMcp = landmarks[5];
    
    // 拇指向内弯曲时，指尖会靠近食指MCP
    const tipToIndexMcp = Math.hypot(tip.x - indexMcp.x, tip.y - indexMcp.y);
    
    // 拇指伸直时，指尖远离食指
    const isExtended = tipToIndexMcp > 0.12;
    
    return !isExtended;
  };
  
  const thumbCurled = isThumbCurled();
  const indexCurled = isFingerCurled(5, 6, 8);
  const middleCurled = isFingerCurled(9, 10, 12);
  const ringCurled = isFingerCurled(13, 14, 16);
  const pinkyCurled = isFingerCurled(17, 18, 20);
  
  const extendedCount = [!indexCurled, !middleCurled, !ringCurled, !pinkyCurled].filter(Boolean).length;
  
  console.log('=== 手指状态 ===', { 
    thumb: thumbCurled ? '弯' : '伸',
    index: indexCurled ? '弯' : '伸', 
    middle: middleCurled ? '弯' : '伸', 
    ring: ringCurled ? '弯' : '伸', 
    pinky: pinkyCurled ? '弯' : '伸',
    extendedCount 
  });
  
  // ☝️ 剑指 - 只有食指伸直
  if (!indexCurled && middleCurled && ringCurled && pinkyCurled) {
    console.log('>>> ☝️ 剑指 (DRAGON)');
    return 'DRAGON';
  }
  
  // ✊ 握拳 - 所有手指弯曲
  if (indexCurled && middleCurled && ringCurled && pinkyCurled && thumbCurled) {
    console.log('>>> ✊ 握拳 (SHIELD)');
    return 'SHIELD';
  }
  
  // ✋ 张开手掌 - 3根以上手指伸直
  if (extendedCount >= 3) {
    console.log('>>> ✋ 张开手掌 (LOTUS)');
    return 'LOTUS';
  }
  
  // 👍 点赞 - 只有拇指伸直
  if (!thumbCurled && indexCurled && middleCurled && ringCurled && pinkyCurled) {
    console.log('>>> 👍 点赞 (DRAGON)');
    return 'DRAGON';
  }
  
  console.log('>>> 默认 (LOTUS)');
  return 'LOTUS';
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
