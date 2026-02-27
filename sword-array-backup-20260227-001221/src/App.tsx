import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { initHandTracking } from './services/HandTrackingService';
import { useHandStore } from './store';
import './index.css';

function StatusIndicator() {
  const isTracking = useHandStore((state) => state.isTracking);
  const gestureMode = useHandStore((state) => state.gestureMode);
  const fingerCount = useHandStore((state) => state.fingerCount);

  const getModeText = () => {
    if (!isTracking) return '⏳ 等待手势...';
    switch (gestureMode) {
      case 'SWORD_CONVERGE': return '✊ 剑聚';
      case 'DRAGON': return '☝️ 游龙';
      case 'GREATSWORD': return '✌️ 大剑';
      case 'SWORD_ARRAY': return '🤟 剑阵';
      case 'SWORD_SCATTER': return '🖖 剑散';
      case 'DRAGON_CLAW': return '🖐️ 龙爪';
      default: return '❓ 未知';
    }
  };

  const getModeColor = () => {
    if (!isTracking) return '#ff6666';
    switch (gestureMode) {
      case 'SWORD_CONVERGE': return '#ff8844';
      case 'DRAGON': return '#00ff88';
      case 'GREATSWORD': return '#ffdd44';
      case 'SWORD_ARRAY': return '#44ddff';
      case 'SWORD_SCATTER': return '#aa88ff';
      case 'DRAGON_CLAW': return '#ff4488';
      default: return '#ffffff';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        padding: '8px 16px',
        background: 'rgba(0, 0, 0, 0.5)',
        borderRadius: '20px',
        color: getModeColor(),
        fontSize: '14px',
        zIndex: 100,
        transition: 'color 0.3s',
      }}
    >
      {getModeText()} {fingerCount >= 0 && `(${fingerCount}指)`}
    </div>
  );
}

function UI() {
  const gestureMode = useHandStore((state) => state.gestureMode);
  const isTracking = useHandStore((state) => state.isTracking);

  const getColor = () => {
    if (!isTracking) return '#00ff88';
    switch (gestureMode) {
      case 'SWORD_CONVERGE': return '#ff8844';
      case 'DRAGON': return '#00ff88';
      case 'GREATSWORD': return '#ffdd44';
      case 'SWORD_ARRAY': return '#44ddff';
      case 'SWORD_SCATTER': return '#aa88ff';
      case 'DRAGON_CLAW': return '#ff4488';
      default: return '#00ff88';
    }
  };

  const getHint = () => {
    if (!isTracking) return '👋 请挥手激活飞剑...';
    switch (gestureMode) {
      case 'SWORD_CONVERGE': return '✊ 握拳 · 万剑归一';
      case 'DRAGON': return '☝️ 剑指 · 游龙随行';
      case 'GREATSWORD': return '✌️ 双指 · 巨剑融合';
      case 'SWORD_ARRAY': return '🤟 三指 · 剑阵护体';
      case 'SWORD_SCATTER': return '🖖 四指 · 剑气四散';
      case 'DRAGON_CLAW': return '🖐️ 张掌 · 龙爪探云';
      default: return '❓ 未知模式';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        zIndex: 100,
        color: '#fff',
        textShadow: '0 0 10px #00ff88',
      }}
    >
      <h1
        style={{
          fontSize: '28px',
          marginBottom: '8px',
          color: getColor(),
          transition: 'color 0.3s',
        }}
      >
        万剑归宗
      </h1>
      <p style={{ fontSize: '14px', opacity: 0.7 }}>{getHint()}</p>
    </div>
  );
}

function LoadingScreen({ step, message }: { step: string; message: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 17, 0.95)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '40px 60px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 100, 200, 0.1))',
          border: '1px solid rgba(0, 255, 136, 0.3)',
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.2)',
        }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 20px',
            border: '3px solid rgba(0, 255, 136, 0.3)',
            borderTopColor: '#00ff88',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <h2 style={{ color: '#00ff88', fontSize: '24px', marginBottom: '15px' }}>
          🗡️ 万剑归宗
        </h2>
        <p style={{ color: '#00ff88', fontSize: '12px', marginBottom: '8px' }}>{step}</p>
        <p style={{ color: '#aaa', fontSize: '14px' }}>{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 17, 0.95)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '40px 60px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(255, 100, 100, 0.1), rgba(200, 50, 50, 0.1))',
          border: '1px solid rgba(255, 100, 100, 0.3)',
        }}
      >
        <h2 style={{ color: '#ff6666', fontSize: '24px', marginBottom: '15px' }}>
          ⚠️ 初始化失败
        </h2>
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>{message}</p>
        <button
          onClick={onRetry}
          style={{
            padding: '10px 30px',
            fontSize: '14px',
            background: 'rgba(0, 255, 136, 0.2)',
            border: '1px solid #00ff88',
            borderRadius: '20px',
            color: '#00ff88',
            cursor: 'pointer',
          }}
        >
          重试
        </button>
      </div>
    </div>
  );
}

function WebcamView({ onReady }: { onReady: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingStep, setLoadingStep] = useState('正在初始化...');
  const [loadingMsg, setLoadingMsg] = useState('请稍候');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const init = async () => {
    if (!videoRef.current) return;
    
    setStatus('loading');
    setLoadingStep('Step 1/3');
    setLoadingMsg('正在请求摄像头权限...');
    
    try {
      const originalLog = console.log;
      console.log = (...args) => {
        originalLog.apply(console, args);
        const msg = args.join(' ');
        if (msg.includes('Step 1') || msg.includes('摄像头')) {
          setLoadingStep('Step 1/3');
          setLoadingMsg('正在请求摄像头权限...');
        } else if (msg.includes('Step 2') || msg.includes('模型')) {
          setLoadingStep('Step 2/3');
          setLoadingMsg('正在加载手势识别模型...');
        } else if (msg.includes('WASM')) {
          setLoadingStep('Step 2/3');
          setLoadingMsg('正在加载 WASM 运行时...');
        } else if (msg.includes('成功')) {
          setLoadingStep('Step 3/3');
          setLoadingMsg('初始化完成！');
        }
      };
      
      const success = await initHandTracking(videoRef.current);
      console.log = originalLog;
      
      if (success) {
        setStatus('ready');
        onReady();
      } else {
        setStatus('error');
        setErrorMsg('手势识别初始化失败，请检查摄像头权限');
      }
    } catch (e) {
      console.error('Init error:', e);
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : '初始化失败');
    }
  };

  useEffect(() => {
    init();
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          width: '120px',
          height: '90px',
          borderRadius: '8px',
          border: `2px solid ${
            status === 'error' ? 'rgba(255, 100, 100, 0.8)' : 
            status === 'ready' ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 200, 100, 0.5)'
          }`,
          transform: 'scaleX(-1)',
          zIndex: 100,
          objectFit: 'cover',
        }}
        autoPlay
        playsInline
        muted
      />
      {status === 'loading' && <LoadingScreen step={loadingStep} message={loadingMsg} />}
      {status === 'error' && <ErrorScreen message={errorMsg} onRetry={init} />}
    </>
  );
}

import { OrientationGuard } from './components/OrientationGuard';

function App() {
  const [isReady, setIsReady] = useState(false);

  return (
    <OrientationGuard>
      <div style={{ width: '100vw', height: '100vh' }}>
        <WebcamView onReady={() => setIsReady(true)} />
        <Canvas
          camera={{ position: [0, 3, 35], fov: 60 }}
          dpr={[1, 2]}
          gl={{ antialias: false, alpha: true }}
        >
          <Scene />
          <HandController />
        </Canvas>
        {isReady && (
          <>
            <StatusIndicator />
            <UI />
          </>
        )}
      </div>
    </OrientationGuard>
  );
}

export default App;