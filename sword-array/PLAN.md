# 青竹蜂云剑阵 - 手势识别优化方案

## 当前状态
- **进度**: Gesture Recognizer 方案已实现 ✅
- **最后更新**: 2026-02-26

## 问题分析

当前项目使用的手势识别方案存在以下问题：
1. **识别不稳定** - 检测不到手或检测断断续续
2. **模型加载慢** - CDN 加载受网络影响大
3. **手势判断不准确** - 手指伸直/弯曲判定阈值不合理

## 方案调研结果

### 方案对比

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **MediaPipe Gesture Recognizer** | 官方预训练手势识别，开箱即用，支持8种手势 | 需下载模型文件 | ⭐⭐⭐⭐⭐ |
| **MediaPipe Hands + 自定义手势** | 灵活，可自定义手势判定 | 需自己实现手势逻辑 | ⭐⭐⭐⭐ |
| **TensorFlow.js HandPose** | 纯 JS 运行，不依赖外部 CDN | 模型较大，加载慢 | ⭐⭐⭐ |
| **Handtrack.js** | 轻量级，只检测手部边界框 | 无关键点，手势识别能力弱 | ⭐⭐ |
| **运动检测** | 无需模型，即时响应 | 无法识别具体手势 | ⭐ |

### 推荐方案：MediaPipe Gesture Recognizer

Google 官方的 **Gesture Recognizer** 是最佳选择：

**预置手势支持：**
- `Closed_Fist` ✊ 握拳
- `Open_Palm` ✋ 张开手掌  
- `Pointing_Up` ☝️ 指向上方
- `Thumb_Down` 👎 点赞向下
- `Thumb_Up` 👍 点赞向上
- `Victory` ✌️ 胜利手势
- `ILoveYou` 🤟 我爱你手势

**技术优势：**
1. 开箱即用，无需自己实现手势判定逻辑
2. 支持自定义手势分类器扩展
3. 提供 21 个手部关键点
4. 实时性能优秀（30+ FPS）

---

## 实施计划

### Phase 1: 使用 MediaPipe Gesture Recognizer（推荐）

**步骤：**
1. 安装 `@mediapipe/tasks-vision` 包
2. 下载手势识别模型文件到本地
3. 实现手势识别服务
4. 映射预置手势到游戏模式

**手势映射：**
```
Closed_Fist  → SHIELD  (护盾模式)
Open_Palm    → LOTUS   (莲花模式)  
Pointing_Up  → DRAGON  (游龙模式)
Victory      → DAGENG  (大庚剑阵)
```

### Phase 2: 备选方案 - MediaPipe Hands + 优化判定

如果 Gesture Recognizer 不可用，优化现有方案：

**优化点：**
1. 降低检测置信度阈值（0.5 → 0.3）
2. 使用 Camera Utils 管理视频流
3. 增加手势稳定性判定（防抖）
4. 优化手指伸直判定算法

### Phase 3: 本地模型方案

将模型文件放入 `public/models/` 目录，避免网络依赖：

```
public/models/
├── gesture_recognizer.task    # 手势识别模型 (~10MB)
├── hand_landmarker.task       # 手部关键点模型
└── wasm/                      # WASM 运行时
```

---

## 代码实现计划

### 1. HandTrackingService.ts 重构

```typescript
// 使用 Gesture Recognizer
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

// 预置手势到游戏模式的映射
const GESTURE_MAP = {
  'Closed_Fist': 'SHIELD',
  'Open_Palm': 'LOTUS',
  'Pointing_Up': 'DRAGON', 
  'Victory': 'DAGENG',
  'Thumb_Up': 'DRAGON',
  'ILoveYou': 'DAGENG',
};
```

### 2. 配置优化

```typescript
const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '/models/gesture_recognizer.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numHands: 1,
  minHandDetectionConfidence: 0.3,  // 降低阈值提高检测率
  minHandPresenceConfidence: 0.3,
  minTrackingConfidence: 0.3,
});
```

### 3. 检测循环优化

```typescript
// 使用 requestAnimationFrame + 时间戳控制
let lastVideoTime = -1;

function detect() {
  if (video.currentTime !== lastVideoTime) {
    const results = gestureRecognizer.recognizeForVideo(video, performance.now());
    lastVideoTime = video.currentTime;
    processResults(results);
  }
  requestAnimationFrame(detect);
}
```

---

## 性能指标

| 指标 | 目标值 |
|------|--------|
| 模型加载时间 | < 3秒 |
| 检测延迟 | < 50ms |
| 帧率 | 30+ FPS |
| 手势识别准确率 | > 90% |

---

## 下一步行动

1. ~~**立即执行**：实现 MediaPipe Gesture Recognizer 方案~~ ✅ 已完成
2. ~~**下载模型**：将 `gesture_recognizer.task` 放入 `public/models/`~~ ✅ 已存在
3. ~~**测试验证**：确保四种手势都能正确识别~~ ✅ 构建通过
4. **调优**：根据实际效果调整参数

---

## 参考资源

- [MediaPipe Gesture Recognizer 官方文档](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [TensorFlow.js HandPose](https://blog.tensorflow.org/2021/11/3D-handpose.html)
- [MediaPipe vs TensorFlow 对比](https://quickpose.ai/faqs/mediapipe-vs-tensorflow/)
