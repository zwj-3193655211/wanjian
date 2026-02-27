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

// 分析手势
function analyzeGesture(landmarks: Landmark[]): GestureMode {
  // 关键点索引
  const thumb = { tip: landmarks[4], ip: landmarks[3], mcp: landmarks[2] };
  const index = { tip: landmarks[8], dip: landmarks[7], pip: landmarks[6], mcp: landmarks[5] };
  const middle = { tip: landmarks[12], dip: landmarks[11], pip: landmarks[10], mcp: landmarks[9] };
  const ring = { tip: landmarks[16], dip: landmarks[15], pip: landmarks[14], mcp: landmarks[13] };
  const pinky = { tip: landmarks[20], dip: landmarks[19], pip: landmarks[18], mcp: landmarks[17] };
  const wrist = landmarks[0];
  
  // 计算手掌参考平面
  const palmBase = {
    x: (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3,
    y: (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3,
  };
  
  // 手指伸直判定 - 改进算法
  const isFingerExtended = (finger: typeof index) => {
    // 方法1: 指尖到掌基距离 vs PIP到掌基距离
    const tipToPalm = Math.hypot(finger.tip.x - palmBase.x, finger.tip.y - palmBase.y);
    const pipToPalm = Math.hypot(finger.pip.x - palmBase.x, finger.pip.y - palmBase.y);
    
    // 方法2: 指尖Y坐标比PIP更高（屏幕坐标系Y向下）
    const isHigher = finger.tip.y < finger.pip.y - 0.02;
    
    // 方法3: 指尖到MCP距离 vs PIP到MCP距离
    const tipToMcp = Math.hypot(finger.tip.x - finger.mcp.x, finger.tip.y - finger.mcp.y);
    const pipToMcp = Math.hypot(finger.pip.x - finger.mcp.x, finger.pip.y - finger.mcp.y);
    
    // 综合判断
    const distanceCheck = tipToPalm > pipToPalm * 0.9;
    const heightCheck = isHigher;
    const ratioCheck = tipToMcp > pipToMcp * 0.8;
    
    return (distanceCheck && heightCheck) || ratioCheck;
  };
  
  // 拇指判定
  const isThumbExtended = () => {
    // 拇指向外伸展
    const thumbTipToPalm = Math.hypot(thumb.tip.x - palmBase.x, thumb.tip.y - palmBase.y);
    const thumbIpToPalm = Math.hypot(thumb.ip.x - palmBase.x, thumb.ip.y - palmBase.y);
    
    // 拇指在X方向伸展
    const xExtension = Math.abs(thumb.tip.x - landmarks[5].x);
    
    return thumbTipToPalm > thumbIpToPalm * 1.1 || xExtension > 0.08;
  };
  
  const thumbExtended = isThumbExtended();
  const indexExtended = isFingerExtended(index);
  const middleExtended = isFingerExtended(middle);
  const ringExtended = isFingerExtended(ring);
  const pinkyExtended = isFingerExtended(pinky);
  
  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
  
  console.log('手指状态:', { 
    thumb: thumbExtended ? '伸' : '弯',
    index: indexExtended ? '伸' : '弯', 
    middle: middleExtended ? '伸' : '弯', 
    ring: ringExtended ? '伸' : '弯', 
    pinky: pinkyExtended ? '伸' : '弯',
    count: extendedCount 
  });
  
  // ✌️ 胜利手势 - 食指和中指伸直，其他弯曲
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return 'DAGENG';
  }
  
  // 🤘 摇滚手势 - 食指和小指伸直
  if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
    return 'DAGENG';
  }
  
  // ☝️ 剑指 - 只有食指伸直
  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'DRAGON';
  }
  
  // ✊ 握拳 - 所有手指弯曲
  if (extendedCount === 0 && !thumbExtended) {
    return 'SHIELD';
  }
  
  // ✋ 张开手掌 - 大部分手指伸直
  if (extendedCount >= 3) {
    return 'LOTUS';
  }
  
  // 👍 点赞手势 - 只有拇指伸直
  if (thumbExtended && extendedCount === 0) {
    return 'DRAGON';
  }
  
  // 🤙 只有食指和小指伸出（类似ILoveYou但无拇指）
  if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
    return 'DAGENG';
  }
  
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
