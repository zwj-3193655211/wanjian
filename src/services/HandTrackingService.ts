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

// 手势防抖：滑动窗口投票 + 连胜加速
let lastGesture: GestureMode = 'LOTUS';
const gestureHistory: GestureMode[] = [];
const GESTURE_WINDOW = 3;       // 窗口缩小到 3 帧（~100ms @ 30fps）
let lastWinner: GestureMode | null = null;   // 上一次投票 winner
let winnerStreakCount = 0;      // winner 连续相同的次数（用于加速）

// 伸直分数阈值
const FINGER_EXT_THRESHOLD = 0.55; // 略严格一点，避免轻微抬起被判为伸直

// 日志节流：每 N 帧打印一次完整分数详情
let frameCounter = 0;
const LOG_EVERY_N_FRAMES = 5;

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

// 检测手势类型 - 滑动窗口投票 + 连胜加速
export function detectGesture(): GestureMode {
  if (!latestResults || !latestResults.multiHandLandmarks || latestResults.multiHandLandmarks.length === 0) {
    return lastGesture; // 没检测到手时保持上一帧
  }

  const landmarks = latestResults.multiHandLandmarks[0];
  const detected = analyzeGesture(landmarks);

  // 把当前帧塞进窗口
  gestureHistory.push(detected);
  if (gestureHistory.length > GESTURE_WINDOW) {
    gestureHistory.shift();
  }

  if (gestureHistory.length === 0) {
    return lastGesture;
  }

  // 投票：哪个手势出现最多就选哪个
  const counts = new Map<GestureMode, number>();
  for (const g of gestureHistory) {
    counts.set(g, (counts.get(g) || 0) + 1);
  }

  let winner: GestureMode = lastGesture;
  let maxVotes = 0;
  for (const [g, v] of counts) {
    if (v > maxVotes) {
      maxVotes = v;
      winner = g;
    }
  }

  // 连胜追踪
  if (winner === lastWinner) {
    winnerStreakCount++;
  } else {
    lastWinner = winner;
    winnerStreakCount = 1;
  }

  // 连胜加速：稳定同一 winner 越久，所需票数越少
  //   streak 1~3：需要 2 票（窗口 3 帧中 67%）
  //   streak 4~10：需要 2 票
  //   streak 11+：只要 winner 是 1 票都接受（极快响应）
  const requiredVotes = winnerStreakCount >= 11 ? 1 : 2;

  if (maxVotes >= requiredVotes) {
    lastGesture = winner;
  }
  return lastGesture;
}

// 3D 距离（用 Z 提升对掌面倾斜的鲁棒性）
const distance3D = (a: Landmark, b: Landmark): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// 分析手势 - 评分制（handSize 归一化 + 3D 距离）
function analyzeGesture(landmarks: Landmark[]): GestureMode {
  // MediaPipe Hands Landmark 索引:
  // 0: 手腕
  // 拇指: 1(CMC), 2(MCP), 3(IP), 4(TIP)
  // 食指: 5(MCP), 6(PIP), 7(DIP), 8(TIP)
  // 中指: 9(MCP), 10(PIP), 11(DIP), 12(TIP)
  // 无名指: 13(MCP), 14(PIP), 15(DIP), 16(TIP)
  // 小指: 17(MCP), 18(PIP), 19(DIP), 20(TIP)

  const wrist = landmarks[0];

  // 1) 手部大小归一化基线：手腕 -> 中指 MCP 的距离
  const handSize = distance3D(wrist, landmarks[9]);
  if (handSize < 1e-6) {
    return 'LOTUS'; // 检测失败兜底
  }

  // 2) 四指伸直分数：指尖到手腕 / MCP 到手腕（与手部远近无关，天然归一化）
  // 弯曲时 tip 接近 mcp，ratio ≈ 1.0
  // 伸直时 tip 远离 wrist，ratio ≈ 1.6~1.8
  const fingerScore = (tipIdx: number, mcpIdx: number): number => {
    const tipDist = distance3D(landmarks[tipIdx], wrist);
    const mcpDist = distance3D(landmarks[mcpIdx], wrist);
    if (mcpDist < 1e-6) return 0;
    const ratio = tipDist / mcpDist;
    // 归一化到 0~1：(ratio - 1.0) / 0.7
    return Math.max(0, Math.min(1, (ratio - 1.0) / 0.7));
  };

  // 3) 拇指伸直分数：拇指尖到食指 MCP 的距离（跨掌面方向）
  // 弯曲 / 自然翘起：ratio ≈ 0.3~0.55 handSize（手一放松就这个范围）
  // 完全伸直（OK 手势 / 5 指全开）：ratio ≈ 0.85~1.05 handSize
  // 要求拇指"明显"伸直才算，避免 1 指食指时被误判
  const thumbScore = (): number => {
    const tipDist = distance3D(landmarks[4], landmarks[5]);
    const ratio = tipDist / handSize;
    return Math.max(0, Math.min(1, (ratio - 0.55) / 0.3));
  };

  const scores = {
    thumb: thumbScore(),
    index: fingerScore(8, 5),
    middle: fingerScore(12, 9),
    ring: fingerScore(16, 13),
    pinky: fingerScore(20, 17),
  };

  const isExt = (s: number) => s > FINGER_EXT_THRESHOLD;
  const extendedCount = [
    isExt(scores.thumb),
    isExt(scores.index),
    isExt(scores.middle),
    isExt(scores.ring),
    isExt(scores.pinky),
  ].filter(Boolean).length;

  // 0~5 映射到 6 个阵型
  const gestureMap: GestureMode[] = ['GATHER', 'DRAGON', 'HUNTIAN', 'PHOENIX', 'LOTUS', 'DAGENG'];
  const detected = gestureMap[extendedCount] || 'LOTUS';

  // 节流日志：每 N 帧打一次完整分数，阵型切换时立即打
  frameCounter++;
  const shouldLogDetails = frameCounter % LOG_EVERY_N_FRAMES === 0;
  const justChanged = detected !== lastGesture;
  if (shouldLogDetails || justChanged) {
    console.log(`[hand] ${extendedCount}指 -> ${detected} | scores:`, {
      thumb: scores.thumb.toFixed(2),
      index: scores.index.toFixed(2),
      middle: scores.middle.toFixed(2),
      ring: scores.ring.toFixed(2),
      pinky: scores.pinky.toFixed(2),
      handSize: handSize.toFixed(3),
    });
  }
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
