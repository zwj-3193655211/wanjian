import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

export function MouseController() {
  const { camera, size } = useThree();
  const setTarget = useHandStore((state) => state.setTarget);
  const setTracking = useHandStore((state) => state.setTracking);
  const setGestureMode = useHandStore((state) => state.setGestureMode);
  const isTracking = useHandStore((state) => state.isTracking);
  const useMouse = useHandStore((state) => state.useMouse);
  const setUseMouse = useHandStore((state) => state.setUseMouse);
  const setMousePosition = useHandStore((state) => state.setMousePosition);
  const cycleGestureMode = useHandStore((state) => state.cycleGestureMode);

  // 鼠标位置引用
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    // 鼠标移动监听 - 始终更新鼠标位置和目标位置
    const handleMouseMove = (e: MouseEvent) => {
      // 归一化鼠标坐标 (0-1)
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      mousePos.current = { x, y };

      // 转换到 NDC 坐标 (-1 到 1)
      const ndcX = x * 2 - 1;
      const ndcY = -(y * 2 - 1);  // Y轴翻转，因为屏幕坐标向下，Three.js向上

      const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      const worldPos = camera.position.clone().add(dir.multiplyScalar(dist));

      setMousePosition(worldPos);
      // 未检测到手时，也更新目标位置
      if (!useHandStore.getState().isTracking) {
        setTarget(worldPos);
      }
    };

    // 鼠标点击监听 - 切换阵型
    const handleClick = () => {
      cycleGestureMode();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, [camera, cycleGestureMode]);

  // 当检测到手时，停止使用鼠标
  useFrame(() => {
    if (isTracking && useMouse) {
      setUseMouse(false);
    } else if (!isTracking && !useMouse) {
      setUseMouse(true);
    }
  });

  return null;
}
