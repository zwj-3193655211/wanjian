# 青竹蜂云剑阵

基于 MediaPipe 手势识别的 3D 飞剑阵型控制应用。使用手指数量控制不同阵型，支持鼠标模式。

## 功能特点

- **6种手指阵型** - 0-5根手指对应不同阵型
- **鼠标模式** - 未检测到手时自动切换到鼠标控制
- **实时手势识别** - 使用 MediaPipe Hands 高精度检测
- **3D 渲染** - 基于 React Three Fiber 的炫酷视觉效果
- **可调节参数** - Tab键打开设置菜单调节飞剑数量和速度

## 阵型说明

| 手指数 | 阵型名称 | 效果描述 |
|--------|---------|---------|
| 0指 | 聚拢阵 🛡️ | 球形轨道围绕焦点旋转 |
| 1指 | 游龙阵 🐉 | 飞剑沿路径游动拖尾 |
| 2指 | 浑天阵 🌌 | 围绕焦点做圆周运动 |
| 3指 | 凤凰阵 🔥 | 双圆环形成∞符号 |
| 4指 | 莲花阵 🌸 | 斐波那契螺旋分布 |
| 5指 | 大庚剑阵 ⚔️ | 主剑+分层旋转剑阵 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 操作说明

### 手势模式
- 举起手掌，让摄像头看到你的手
- 用不同数量的手指控制阵型
- 白点显示焦点位置（手心或鼠标）

### 鼠标模式
- 当摄像头未检测到手时自动启用
- 移动鼠标控制焦点位置
- 点击屏幕切换阵型

### 设置菜单
- 按 `Tab` 键打开/关闭设置菜单
- 调节飞剑数量、速度等参数
- 点击"确认"应用设置

## 技术栈

- **React** - UI 框架
- **Three.js** - 3D 渲染
- **React Three Fiber** - React 三维渲染器
- **MediaPipe Hands** - 手势识别
- **Zustand** - 状态管理
- **Vite** - 构建工具

## 项目结构

```
src/
├── components/
│   ├── Scene.tsx          # 主场景
│   ├── SwordSwarm.tsx     # 飞剑粒子系统
│   ├── HandController.tsx # 手势控制
│   ├── MouseController.tsx# 鼠标控制
│   ├── FingerPointer.tsx  # 焦点白点
│   ├── ShieldOrb.tsx      # 护盾核心
│   ├── SettingsMenu.tsx   # 设置菜单
│   └── OrientationGuard.tsx
├── services/
│   └── HandTrackingService.ts  # 手势识别服务
├── store.ts               # 状态管理
└── App.tsx                # 主应用
```

## 浏览器要求

- Chrome 90+
- Edge 90+
- Safari 14+
- Firefox 88+

需要支持：
- WebGL
- WebRTC (摄像头访问)
- ES2020+

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 类型检查
npm run type-check

# 构建
npm run build

# 预览构建结果
npm run preview
```

## 许可证

MIT

## 作者

Created with Claude Code
