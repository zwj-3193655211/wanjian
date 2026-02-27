import { useState, useEffect } from 'react';

interface OrientationGuardProps {
  children: React.ReactNode;
}

export function OrientationGuard({ children }: OrientationGuardProps) {
  const [isLandscape, setIsLandscape] = useState(
    window.innerWidth > window.innerHeight
  );

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 在移动端显示横屏提示
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile && !isLandscape) {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.icon}>📱</div>
          <h2 style={styles.title}>请横屏游玩</h2>
          <p style={styles.text}>将手机旋转至横屏模式以获得最佳体验</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 17, 0.95)',
    zIndex: 9999,
  },
  card: {
    textAlign: 'center',
    padding: '40px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 100, 200, 0.1))',
    border: '1px solid rgba(0, 255, 136, 0.3)',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '20px',
    animation: 'rotate-hint 2s ease-in-out infinite',
  },
  title: {
    color: '#00ff88',
    fontSize: '24px',
    marginBottom: '10px',
  },
  text: {
    color: '#aaa',
    fontSize: '16px',
  },
};
