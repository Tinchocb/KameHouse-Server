import React, { useEffect } from 'react';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useStore } from '../store';

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

export default function ErrorScreen() {
  const setScreen = useStore(state => state.setScreen);
  const serverUrl = useStore(state => state.serverUrl);

  const { ref, focusKey } = useFocusable({
    focusKey: 'ERROR_SCREEN',
    trackChildren: true,
    autoRestoreFocus: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('btn-retry');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = async () => {
    try {
      setScreen('loading');
      const res = await fetch(`${serverUrl}/api/v1/status`);
      if (res.ok) {
        setScreen('home');
      } else {
        throw new Error('Invalid status');
      }
    } catch (err) {
      setScreen('error');
    }
  };

  const handleChangeAddress = () => {
    setScreen('config');
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref as any} className="screen" id="screen-error">
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <div className="error-title">Error de conexión</div>
          <div className="error-detail">No se pudo conectar al servidor <strong>{serverUrl}</strong>.<br/>Verificá la IP y que el servidor esté encendido.</div>
          <div className="btn-group">
            <FocusableButton focusKey="btn-retry" className="btn btn-primary" onClick={handleRetry}>Reintentar</FocusableButton>
            <FocusableButton focusKey="btn-change-address" className="btn btn-secondary" onClick={handleChangeAddress}>Cambiar dirección</FocusableButton>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
