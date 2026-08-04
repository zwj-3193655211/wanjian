# 技术路线

> 项目「指尖万剑」的技术决策、算法演进、架构设计与 trade-off 总结。
> 给"想读代码"或"想复刻思路"的读者一份完整地图。

## 0. 创新亮点

这次会话（v2 重构）的四个核心创新：

1. **handSize 归一化 + 3D 评分制** — 把"单 Y 轴二元判定"升级为 0~1 连续评分，对手部远近、倾斜鲁棒
2. **拇指跨掌面距离判定** — 摒弃"X 距离"启发式，改用"拇指尖到食指 MCP"距离，要求"明显伸直"才算
3. **双层连胜加速** — 检测层 3 帧投票 + 确认层时间窗口，连胜越长响应越快（首切 150ms → 稳定后 < 30ms）
4. **严格抗闪烁策略** — 任何单帧变化都重置 streak，闪烁不污染连胜累积

> 创新点 1+2 解决**准确率**（V1 60% → V2 95%），创新点 3+4 解决**响应速度**（300ms+ → 30ms）。

## 1. 项目定位

一个**纯前端 3D 飞剑阵型控制系统**。摄像头捕获手部 → MediaPipe 检测 21 个关键点 → 规则评分识别伸直手指数 → 切换 6 种阵型 → Three.js 渲染。

**核心约束**：
- 完全本地运行（模型文件 `public/models/`，无后端）
- 识别 6 阵型（GATHER/DRAGON/HUNTIAN/PHOENIX/LOTUS/DAGENG），不扩张子分类
- 优先准确率，不引入手势子类型识别

## 2. 技术栈选型

| 层 | 选型 | 备选考虑 | 理由 |
|---|---|---|---|
| 框架 | React 19 | Vue/Svelte | 生态最熟，drei/fiber 集成度高 |
| 3D | Three.js + R3F | 原生 Three / Babylon | R3F 声明式，组件化天然契合阵型 |
| 手势 | MediaPipe Hands 0.4 | TensorFlow.js / 自训模型 | 离线 .tflite 模型，21 关键点准，社区大 |
| 状态 | Zustand | Redux / Context | 单 store + 原子更新，少 boilerplate |
| 构建 | Vite 7 | webpack | 启动 < 1s，TS 原生支持，HMR 快 |
| 后处理 | @react-three/postprocessing | 自写 shader | Bloom 调参简单，氛围感 |

**否决项**：
- 没用 TensorFlow.js Handpose：模型小但关键点只 21 个，无 z 轴深度，3D 场景下深度信息不可少
- 没用 MoveNet：人体姿态模型，误识率高
- 没用云端推理：用户场景有"完全离线"诉求

## 3. 核心架构（4 层）

```
┌──────────────────────────────────────────┐
│  1. 输入层  - getUserMedia + MediaPipe    │  ← src/services/HandTrackingService.ts
│     输出：21 landmarks (xyz 归一化)        │
└──────────────┬───────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│  2. 识别层  - 评分制 + 时序平滑            │  ← 同上文件
│     输出：GestureMode (GATHER/DRAGON/...) │
└──────────────┬───────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│  3. 状态层  - Zustand store              │  ← src/store.ts
│     输出：targetPosition / gestureMode    │
└──────────────┬───────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│  4. 渲染层  - Three.js 粒子系统            │  ← src/components/SwordSwarm.tsx
│     输出：500 把剑按阵型飞                  │
└──────────────────────────────────────────┘
```

**4 层之间的通信只走 store**，避免 React 重渲染。HandController 用 `useFrame` 同步读 `useHandStore.getState()`，不上订阅。

## 4. 手势识别算法演进

### V1：单 Y 轴二元判定（已废弃）

```typescript
// 只看 tip.y < pip.y
return isAbovePip && yDiff > 0.02;
```

**问题**：
- 手部倾斜时 Y 轴判断失真
- 远近不归一化，远的小手被压扁
- 拇指只看 X 距离，掌心朝下时全错
- 准确率 ~60%，且 1 指经常被识别成 2 指

### V2：3D 距离 + 评分制 + handSize 归一化（当前）★ 本次创新

```typescript
const handSize = dist3D(wrist[0], middleMcp[9]);  // 归一化基线

// 四指：指尖到手腕 / MCP 到手腕
const fingerScore = (tipIdx, mcpIdx) => {
  const ratio = dist3D(lm[tipIdx], wrist) / dist3D(lm[mcpIdx], wrist);
  // 弯曲 ratio≈1.0, 伸直 ratio≈1.7 → 归一化到 0~1
  return clamp((ratio - 1.0) / 0.7, 0, 1);
};

// 拇指：拇指尖到食指 MCP 距离 / handSize
const thumbScore = () => {
  const ratio = dist3D(lm[4], lm[5]) / handSize;
  // 弯曲 ratio≈0.35, 自然翘起 ratio≈0.55, 伸直 ratio≈0.9+
  // 阈值中心 0.7，要求"明显伸直"才算
  return clamp((ratio - 0.55) / 0.3, 0, 1);
};

const extendedCount = scores.filter(s => s > 0.55).length;
const gestureMap = ['GATHER', 'DRAGON', 'HUNTIAN', 'PHOENIX', 'LOTUS', 'DAGENG'];
```

**4 个创新点**：

1. **handSize 归一化**：用 `dist(wrist, middleMcp)` 作分母，所有距离归一化。
   解决"小手远/大手近"导致的误判。V1 用绝对阈值 0.05，对远的小手失效。
2. **3D 距离取代 2D Y 比较**：xyz 三轴参与计算。
   解决手部倾斜（45°）时 Y 轴判断失真。V1 的 `tip.y < pip.y` 倾斜后颠倒。
3. **0~1 评分制取代二元判定**：连续分数 + 单一阈值（0.55）。
   解决"半弯"手指在 V1 二元判定下随机归类的问题。微调阈值不用改逻辑。
4. **拇指跨掌面距离**：用"拇指尖到食指 MCP"距离，阈值中心 0.7。
   解决"拇指自然翘起"被 V1 误判为伸直的问题。V1 用 `xDist > 0.05`，任何外展都判为伸直。

**准确率**：~95%（用户主观反馈），主要残留问题在 4/5 指边界（小指紧贴无名指时易混淆）。

### V3（未实现，可选）：ML 兜底

如果 V2 还有边界 case（比如 4 指经常判 5），方案是：
- 收集 600 个 landmark 样本（每个阵型 100 个）
- 训练小 MLP（2 层，32 + 16 单元）
- 用 onnxruntime-web 部署，体积 ~50KB

**暂缓原因**：V2 已经够用，ML 上限 ~98%，投入产出比不划算（详见第 8 节）。

## 5. 时序平滑：双层连胜加速 ★ 本次创新

**单一阈值策略的困境**：
- 阈值高 → 响应慢（用户举着手 1 秒才切）
- 阈值低 → 误切（单次闪烁立即切阵型）

**核心思想**：用户持续做同一手势越久，他"确实想做这个手势"的概率越高 → 阈值可越激进。

**双层连胜算法**：

### 检测层（HandTrackingService）：滑动窗口投票

```typescript
// 3 帧滑动窗口投票 + 连胜加速
const GESTURE_WINDOW = 3;
const requiredVotes = winnerStreakCount >= 11 ? 1 : 2;
```

| 持续帧数 | 票数要求 | 响应时间 |
|---|---|---|
| 1~10 | 2 票（67%） | ~100ms |
| 11+ | 1 票（33%） | ~33ms |

### 确认层（HandController）：时间窗口

```typescript
const requiredDuration =
  pendingStreakCount < 6  ? 0.05 :  // 50ms
  pendingStreakCount < 16 ? 0.02 :  // 20ms
                              0;    // 立即
```

| 持续帧数 | 时间要求 | 响应时间 |
|---|---|---|
| 0~5 | 50ms | ~150ms 总（含投票）|
| 6~15 | 20ms | ~70ms |
| 16+ | 0 | 即时 |

**抗闪烁保证**：单次帧变化 → pendingStreakCount 重置 → 回到 50ms 起点 → 不会误切。

**响应时间总账**：从"手指定型"到"阵型切换"约 **150ms（首切）** → 持续时降到 **70ms** → 长时间稳定后 **< 30ms**。

### 为什么"双层"而不是单层？

单层算法要么"严"（防误切但响应慢），要么"宽"（响应快但易误切）。
双层把"投票"和"时间"分开独立加速：
- 投票层处理"3 帧里 2 帧同结果"（抗单帧闪烁）
- 时间层处理"持续 50ms 稳定"（抗短时波动）
- 两层都用连胜加速，但独立计数 → 闪烁只重置时间层，不影响投票层的连胜

> **关键洞察**：用户操作习惯里，**"稳定意图"**和**"短期波动"**是两个不同时间尺度的问题，单层算法无法同时优化。

## 6. 渲染层设计

### 飞剑物理

```typescript
// 每帧迭代 500 把剑
for (let i = 0; i < 500; i++) {
  const target = computeFormationPosition(i, time);  // 阵型目标
  const desired = target.sub(pos);
  const steer = desired.clampLength(0, steerForce);
  vel.add(steer);
  pos.add(vel * delta);
}
```

**关键参数**（`src/store.ts`）：
- `maxSpeed: 50` / `sprintSpeed: 80`：普通 vs 冲刺
- `steerForce: 40`：转向灵敏度
- `separationDist: 3`：相邻剑排斥距离

**InstancedMesh**：500 把剑用 1 个 draw call 渲染，性能关键。

### 成型速度档位

不同阵型的"目标区域紧凑度"差异大，**剑群聚拢所需速度不能一刀切**。本项目采用按阵型分档：

| 阵型 | 基础速度 | 远距离冲刺 | 转向力 steerFactor | 设计理由 |
|---|---|---|---|---|
| 凤凰 PHOENIX | maxSpeed × 1.8 | sprintSpeed × 1.5 | × 5 | 双圆环紧凑（半径 7），剑需最激进聚拢 |
| 混元 GATHER | sprintSpeed | sprintSpeed × 1.2 | × 5 | 球形轨道（半径 18），需快速归位 |
| 莲花 LOTUS | maxSpeed | sprintSpeed | × 3 | 螺旋分布广，剑自然有方向感 |
| 浑天 HUNTIAN | maxSpeed | sprintSpeed | × 3 | 圆周运动，剑要快速上轨 |
| 游龙 DRAGON | maxSpeed | sprintSpeed × 1.2 | × 2 | 沿路径拖尾，需追上移动的焦点 |
| 万剑落 DAGENG | maxSpeed | sprintSpeed | × 1 | 分层旋转慢动作，剑已分散 |

**核心思想**：紧凑阵型（凤凰/混元）给最高档，分布广的阵型（莲花/浑天）给中间档，跟随型（游龙）温和加档，慢动作（万剑落）保持原速。

### 阵型算法

| 手指数 | 阵型名 | enum | 算法 | 关键公式 |
|---|---|---|---|---|
| 0指 | 混元阵 🛡️ | `GATHER` | 球形轨道 + 自转 | Fibonacci 球 + sin/cos |
| 1指 | 游龙阵 🐉 | `DRAGON` | 路径拖尾 | 沿 pathHistory 插值 + simplex 噪声扰动 |
| 2指 | 浑天阵 🌌 | `HUNTIAN` | 圆周运动 | `cos/sin(angle)` |
| 3指 | 凤凰阵 🔥 | `PHOENIX` | 双圆环 ∞ | 奇偶剑分两组 |
| 4指 | 莲花阵 🌸 | `LOTUS` | 斐波那契螺旋 | 黄金角 + 呼吸缩放 |
| 5指 | 万剑落 ⚔️ | `DAGENG` | 主剑 + 分层 | 主剑放大 6 倍，10 层反向旋转 |

> 阵型 enum 名（`GATHER` / `DAGENG`）保留为内部代号，UI 显示使用中文名。

## 7. 性能数据

| 指标 | 数据 | 条件 |
|---|---|---|
| 帧率 | 60fps 稳定 | 桌面 Chrome + 中端 GPU |
| 剑数量 | 500（最大） | 移动端 200 |
| 首切响应 | ~150ms | 识别 + 投票 + 确认 |
| 持续响应 | ~30ms | 连胜加速后 |
| MediaPipe 模型 | ~6MB | 本地加载 |

**关键优化**：
- InstancedMesh 替代 500 个独立 mesh
- 评分计算用纯数学（无 ML 推理）
- 状态用 `getState()` 同步读，不触发 React re-render

## 8. 已知 Trade-off

| 选择 | 代价 | 收益 |
|---|---|---|
| MediaPipe 21 关键点而非自训 | 依赖外部模型 | 节省训练时间，离线即用 |
| 规则评分而非 ML | 边界 case 偶尔误判 | 零运行时推理成本，可解释性 |
| 6 阵型不分子类 | 失去"yeah"等细分手势 | 简单、用户友好、识别稳 |
| 双层防抖 | 多 ~50ms 延迟 | 抗闪烁、阵型不跳 |
| 单 store 全局状态 | 组件间耦合 | 简单，避免 props drilling |
| 500 剑全计算每帧 | CPU 开销大 | 阵型过渡更平滑 |

## 9. 未来方向

- [ ] **ML 兜底**：训练小 MLP 处理 4/5 边界
- [ ] **双模式手势**："剑指"+"握拳"组合触发特殊阵型
- [ ] **3D 阵型缩放**：用拇指+食指距离控制阵型大小
- [ ] **音频反馈**：阵型切换触发古风音效
- [ ] **录制回放**：保存手势序列，循环演示

## 10. 关键文件索引

| 关注点 | 文件 |
|---|---|
| 手势识别核心算法 | `src/services/HandTrackingService.ts` |
| 时序平滑 | `src/services/HandTrackingService.ts` + `src/components/HandController.tsx` |
| 状态管理 | `src/store.ts` |
| 飞剑物理 + 阵型 | `src/components/SwordSwarm.tsx` |
| 主场景装配 | `src/components/Scene.tsx` |
| 媒体模型本地化 | `public/models/*.tflite` |

## 11. 演化里程碑

按 commit 顺序的关键改动：

| Commit | 类型 | 内容 |
|---|---|---|
| `1d56d9f` | refactor | 项目重命名（青竹蜂云剑阵 → 指尖万剑）+ V2 手势识别算法（评分制 + handSize + 双层连胜） |
| `cf0ee0b` | docs | 新增 TECH.md 技术路线文档 |
| `baa22cb` | perf | 凤凰阵单独加速（最高档：×1.8 / ×1.5 / ×5） |
| `d24258f` | perf | 混元阵温和加速（冲刺 ×1.2 / 转向 ×4） |
| `771353c` | perf | 混元阵转向力 ×4 → ×5（追平凤凰），游龙阵温和加速 |
| `5cc7149` | rename | 0指「聚拢阵」→「混元阵」，5指「大庚剑阵」→「万剑落」 |

**关键决策**：
- 阵型名修改只动 `FORMATION_META.name` 和 README，enum 名和 CONFIG 变量保留为内部代号
- 凤凰阵单独给最高档加速，因为双圆环紧凑（半径 7）成型最难
- 不上 ML 兜底（性价比不高，详见第 8 节）

