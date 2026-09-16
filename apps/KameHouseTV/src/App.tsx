import React, { useEffect } from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import { useStore } from './store';
import ConfigScreen from './screens/ConfigScreen';
import HomeScreen from './screens/HomeScreen';
import DetailsScreen from './screens/DetailsScreen';
import PlayerScreen from './screens/PlayerScreen';
import ErrorScreen from './screens/ErrorScreen';
import { registerTizenKeys, exitTizenApp } from './utils/tizen';
import { connectCastSocket, disconnectCastSocket } from './utils/ws';

// Initialize spatial navigation globally
init({
  debug: false,
  visualDebug: false,
});

class TvErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(err: unknown, info: React.ErrorInfo) {
    console.error('[TV Crash]', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen flex flex-col items-center justify-center p-8 text-center bg-black text-white">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error en KameHouse TV</h1>
          <p className="text-sm text-zinc-400 mb-6 font-mono max-w-md">{this.state.error}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: '' });
              useStore.getState().setScreen('home');
            }}
            className="px-6 py-3 bg-white text-black font-black uppercase rounded-xl cursor-pointer"
          >
            Volver al Inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoadingScreen = () => (
  <div className="screen" id="screen-loading">
    <div className="spinner-container">
      <div className="spinner"></div>
      <div className="status-text">Iniciando KameHouse TV<span className="loading-dots"></span></div>
    </div>
  </div>
);

export default function App() {
  const currentScreen = useStore((state) => state.currentScreen);
  const serverUrl = useStore((state) => state.serverUrl);
  const setScreen = useStore((state) => state.setScreen);

  useEffect(() => {
    registerTizenKeys();
    
    // Auto-connect logic
    if (serverUrl) {
      setScreen('loading');
      fetch(`${serverUrl}/api/v1/status`)
        .then(res => {
          if (res.ok) setScreen('home');
          else throw new Error('Status false');
        })
        .catch(() => setScreen('error'));
    } else {
      setScreen('config');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      // Prevent default scrolling for arrow keys when not editing text
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!isInputActive) {
          e.preventDefault();
        }
      }

      // Si se está editando en un input, permitir que Backspace borre texto sin cerrar la app
      if (e.key === 'Backspace' && isInputActive) {
        return;
      }
      
      // Global Back/Return handling
      if (['Escape', 'Backspace', 'GoBack', 'Return', 'Back'].includes(e.key) || e.keyCode === 10009 || e.keyCode === 27) {
        if (isInputActive) {
          activeEl.blur();
          return;
        }
        const screen = useStore.getState().currentScreen;
        if (screen === 'home' || screen === 'error') {
          exitTizenApp();
        } else if (screen === 'config') {
          if (useStore.getState().serverUrl) {
            useStore.getState().setScreen('home');
          } else {
            exitTizenApp();
          }
        } else {
          useStore.getState().handleBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Canal de cast: mientras haya un servidor configurado mantenemos el
  // WebSocket abierto (con reconexión) para que la web pueda mandarnos
  // contenido con "Enviar a TV". Se reconecta solo si cambia la URL.
  useEffect(() => {
    if (!serverUrl) {
      disconnectCastSocket();
      return;
    }
    connectCastSocket(serverUrl);
    return () => {
      disconnectCastSocket();
    };
  }, [serverUrl]);

  return (
    <TvErrorBoundary>
      <div id="app">
        {currentScreen === 'loading' && <LoadingScreen />}
        {currentScreen === 'config' && <ConfigScreen />}
        {currentScreen === 'error' && <ErrorScreen />}
        {currentScreen === 'home' && <HomeScreen />}
        {currentScreen === 'details' && <DetailsScreen />}
        {currentScreen === 'player' && <PlayerScreen />}
      </div>
    </TvErrorBoundary>
  );
}
