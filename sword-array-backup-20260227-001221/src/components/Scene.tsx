import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { SwordSwarm } from './SwordSwarm';
import { HandController } from './HandController';
import { TrajectoryPoints } from './TrajectoryPoints';
import { DragonHead } from './DragonLightning';

export function Scene() {
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={0.5} />
      
      {/* 点光源 */}
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#00ff88" />
      
      {/* 星空背景 */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade />
      
      {/* 飞剑群 */}
      <SwordSwarm />
      
      {/* 手势控制器 */}
      <HandController />
      
      {/* 白点（游龙和大剑模式） */}
      <TrajectoryPoints />
      
      {/* 龙头特效（龙爪模式） */}
      <DragonHead />
      
      {/* 后期处理 - 辉光效果 */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  );
}