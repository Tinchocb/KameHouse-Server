import React, { useState, useEffect, useRef } from 'react';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useStore } from '../store';
import { scanNetwork } from '../utils/scanner';

function normalizeAddress(input: string) {
  let val = input.trim();
  if (!val) return '';
  if (/^\d+\.\d+\.\d+\.\d+/.test(val) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(val)) {
    if (!/:\d+$/.test(val)) val += ':43211';
    if (!/^https?:\/\//i.test(val)) val = 'http://' + val;
    return val;
  }
  if (/^https?:\/\//i.test(val)) {
    let u = val.replace(/\/+$/, '');
    if (!/:\d+$/.test(u.replace(/^https?:\/\//i, ''))) {
      u += ':43211';
    }
    return u;
  }
  return val;
}

const FocusableButton = ({ onClick, className, children, focusKey }: any) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick,
    focusKey
  });
  return (
    <button
      ref={ref as any}
      onClick={onClick}
      className={`${className} ${focused ? 'focused' : ''}`}
    >
      {children}
    </button>
  );
};

const FocusableInput = ({ value, onChange, placeholder, onEnter, focusKey }: any) => {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => {
      if (ref.current) {
        (ref.current as any).focus();
      }
      if (onEnter) onEnter();
    },
  });

  return (
    <input
      ref={ref as any}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={focused ? 'focused' : ''}
    />
  );
};

export default function ConfigScreen() {
  const [ip, setIp] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  
  const setServerUrl = useStore(state => state.setServerUrl);
  const setScreen = useStore(state => state.setScreen);

  const { ref, focusKey } = useFocusable({
    focusKey: 'CONFIG_SCREEN',
    trackChildren: true,
    autoRestoreFocus: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('input-server-ip');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleConnect = async (urlToTest?: string) => {
    const rawUrl = urlToTest || ip;
    if (!rawUrl) return;
    
    const url = normalizeAddress(rawUrl);
    setServerUrl(url);
    
    try {
      setScreen('loading');
      const res = await fetch(`${url}/api/v1/status`);
      if (res.ok) {
        setScreen('home');
      } else {
        throw new Error('Invalid status');
      }
    } catch (err) {
      setError(`No se pudo conectar a ${url}`);
      setScreen('config');
    }
  };

  const connectTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
      }
    };
  }, []);

  const handleScan = () => {
    setScanning(true);
    setScanStatus('Buscando servidores en la red...');
    let found = false;
    
    scanNetwork(
      (foundUrl) => {
        found = true;
        setScanning(false);
        setIp(foundUrl);
        setScanStatus(`Encontrado: ${foundUrl}. Conectando...`);
        if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
        connectTimerRef.current = setTimeout(() => handleConnect(foundUrl), 1000);
      },
      (subnet) => {
        setScanStatus(`Escaneando subred ${subnet}.x...`);
      }
    ).then(() => {
      setScanning((isScanning) => {
        if (isScanning && !found) {
          setScanStatus('No se encontraron servidores.');
          return false;
        }
        return isScanning;
      });
    });
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref as any} className="screen" id="screen-config">
        <div className="logo">Kame<span>House</span><small>TV</small></div>
        <div className="subtitle">Configura tu servidor KameHouse</div>
        <div className="panel">
          <h2>Dirección del servidor</h2>
          {error && <div style={{color: 'var(--error)', marginBottom: '16px', textAlign: 'center'}}>{error}</div>}
          <div className="input-group">
            <label>IP o dominio</label>
            <FocusableInput 
              focusKey="input-server-ip"
              value={ip} 
              onChange={(e: any) => setIp(e.target.value)} 
              placeholder="ej: 192.168.1.100:43211" 
              onEnter={() => handleConnect()}
            />
            <div className="input-hint">Incluí el puerto si no usás el predeterminado (43211)</div>
          </div>
          <div className="btn-group">
            <FocusableButton focusKey="btn-connect" className="btn btn-primary" onClick={() => handleConnect()}>Conectar</FocusableButton>
            <FocusableButton focusKey="btn-scan" className="btn btn-secondary" onClick={handleScan}>
              {scanning ? 'Buscando...' : 'Buscar en la red'}
            </FocusableButton>
          </div>
          {scanStatus && (
            <div style={{marginTop: '20px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center'}}>
              {scanStatus}
            </div>
          )}
        </div>
        <div className="help-text" style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          Presioná <strong>Enter</strong> para conectar &middot; Usá las <strong>flechas</strong> para navegar &middot; <strong>Return</strong> para salir
        </div>
      </div>
    </FocusContext.Provider>
  );
}
