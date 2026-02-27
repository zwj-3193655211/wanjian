import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

export function DivineLightning() {
  const linesRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const indices: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        40,
        (Math.random() - 0.5) * 60
      );
      const end = new THREE.Vector3(0, 0, 0);

      // 创建闪电路径
      const segments = 8;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const point = start.clone().lerp(end, t);
        
        // 添加随机偏移
        if (j > 0 && j < segments) {
          point.x += (Math.random() - 0.5) * 5;
          point.z += (Math.random() - 0.5) * 5;
        }
        
        points.push(point);
        
        if (j > 0) {
          indices.push(points.length - 2, points.length - 1);
        }
      }
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    geo.setIndex(indices);
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const gestureMode = useHandStore.getState().gestureMode;
    const isTracking = useHandStore.getState().isTracking;
    const target = useHandStore.getState().targetPosition;

    if (linesRef.current) {
      linesRef.current.visible = gestureMode === 'DAGENG' && isTracking;
      
      if (linesRef.current.visible) {
        linesRef.current.position.copy(target);
        linesRef.current.position.y -= 5;
        
        // 随机闪烁
        const mat = linesRef.current.material as THREE.LineBasicMaterial;
        mat.opacity = Math.random() > 0.3 ? 0.8 : 0.2;
      }
    }
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} material={material} visible={false} />
  );
}
