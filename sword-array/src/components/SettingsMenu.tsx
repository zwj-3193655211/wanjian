import { useState, useEffect } from 'react';
import { useHandStore } from '../store';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
  const config = useHandStore((s) => s.config);
  const setConfig = useHandStore((s) => s.setConfig);
  const resetConfig = useHandStore((s) => s.resetConfig);
  const [tempConfig, setTempConfig] = useState({ ...config });

  // 同步当前配置到临时状态
  useEffect(() => {
    if (isOpen) {
      setTempConfig({ ...config });
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setConfig(tempConfig);
    onClose();
  };

  const handleReset = () => {
    resetConfig();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'rgba(0, 0, 17, 0.95)',
          border: '1px solid rgba(0, 255, 136, 0.3)',
          borderRadius: '20px',
          padding: '30px',
          minWidth: '320px',
          maxWidth: '400px',
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.2)',
        }}
      >
        <h2
          style={{
            color: '#00ff88',
            marginBottom: '20px',
            textAlign: 'center',
            fontSize: '24px',
          }}
        >
          ⚙️ 阵法配置
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              color: '#fff',
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
            }}
          >
            飞剑数量: {tempConfig.swordCount}
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={tempConfig.swordCount}
            onChange={(e) =>
              setTempConfig({ ...tempConfig, swordCount: Number(e.target.value) })
            }
            style={{
              width: '100%',
              accentColor: '#00ff88',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              color: '#fff',
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
            }}
          >
            最大速度: {tempConfig.maxSpeed}
          </label>
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            value={tempConfig.maxSpeed}
            onChange={(e) =>
              setTempConfig({ ...tempConfig, maxSpeed: Number(e.target.value) })
            }
            style={{
              width: '100%',
              accentColor: '#00ff88',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              color: '#fff',
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
            }}
          >
            冲刺速度: {tempConfig.sprintSpeed}
          </label>
          <input
            type="range"
            min="40"
            max="150"
            step="10"
            value={tempConfig.sprintSpeed}
            onChange={(e) =>
              setTempConfig({ ...tempConfig, sprintSpeed: Number(e.target.value) })
            }
            style={{
              width: '100%',
              accentColor: '#00ff88',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              color: '#fff',
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
            }}
          >
            转向力: {tempConfig.steerForce}
          </label>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={tempConfig.steerForce}
            onChange={(e) =>
              setTempConfig({ ...tempConfig, steerForce: Number(e.target.value) })
            }
            style={{
              width: '100%',
              accentColor: '#00ff88',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(0, 255, 136, 0.2)',
              border: '1px solid #00ff88',
              borderRadius: '8px',
              color: '#00ff88',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.2)';
            }}
          >
            确认
          </button>
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(255, 100, 100, 0.2)',
              border: '1px solid #ff6666',
              borderRadius: '8px',
              color: '#ff6666',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 100, 100, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 100, 100, 0.2)';
            }}
          >
            重置
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(200, 200, 200, 0.2)',
              border: '1px solid #aaa',
              borderRadius: '8px',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(200, 200, 200, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(200, 200, 200, 0.2)';
            }}
          >
            取消
          </button>
        </div>

        <div
          style={{
            marginTop: '15px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
          }}
        >
          按 Tab 键关闭菜单
        </div>
      </div>
    </div>
  );
}
