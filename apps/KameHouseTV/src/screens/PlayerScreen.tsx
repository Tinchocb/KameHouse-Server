import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { getDeviceId } from '../utils/ws';

export default function PlayerScreen() {
  const serverUrl = useStore(state => state.serverUrl);
  const selectedAnimeId = useStore(state => state.selectedAnimeId);
  const selectedEpisodeId = useStore(state => state.selectedEpisodeId);
  const setScreen = useStore(state => state.setScreen);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [showOSD, setShowOSD] = useState(true);
  const osdTimerRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;
    // Resolve stream
    const fetchStream = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/v1/resolver/streams?episodeId=${selectedEpisodeId}`);
        const data = await res.json();
        if (isCancelled) return;
        if (data && data.length > 0) {
          let url = data[0].url;
          if (!url.startsWith('http')) url = serverUrl + url;
          setStreamUrl(url);
        } else {
          // fallback to local-files fetch (simplified for this example)
          const localRes = await fetch(`${serverUrl}/api/v1/library/anime-entry/${selectedAnimeId}/local-files`);
          const localFiles = await localRes.json();
          if (isCancelled) return;
          const fileInfo = localFiles.find((f: any) => f.episodeId === selectedEpisodeId);
          if (fileInfo) {
            const clientID = getDeviceId();
            const reqRes = await fetch(`${serverUrl}/api/v1/mediastream/request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: fileInfo.path, streamType: 'direct', clientID, force: false })
            });
            const reqData = await reqRes.json();
            if (isCancelled) return;
            if (reqData && reqData.streamUrl) {
              let url = reqData.streamUrl;
              if (!url.startsWith('http')) url = serverUrl + url;
              setStreamUrl(url);
            }
          }
        }
      } catch (err) {
        if (!isCancelled) console.error("Stream resolution failed", err);
      }
    };
    fetchStream();
    return () => { isCancelled = true; };
  }, [serverUrl, selectedAnimeId, selectedEpisodeId]);

  useEffect(() => {
    if (streamUrl && videoRef.current) {
      videoRef.current.play().catch(e => console.error('Playback auto-start prevented:', e));
      triggerOSD();
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [streamUrl]);

  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, []);

  const triggerOSD = () => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowOSD(false);
    }, 4000);
  };

  const progressFillRef = useRef<HTMLDivElement>(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      const perc = dur > 0 ? (curr / dur) * 100 : 0;
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${perc}%`;
      }

      // Throttled continuity sync every 10 seconds
      const now = Date.now();
      if (now - lastSyncRef.current > 10000 && selectedEpisodeId && curr > 0) {
        lastSyncRef.current = now;
        fetch(`${serverUrl}/api/v1/continuity/item`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            options: {
              mediaId: Number(selectedAnimeId) || 0,
              episodeNumber: Number(selectedEpisodeId) || 1,
              currentTime: curr,
              duration: dur || 0,
              kind: 'mediastream',
              predictive: false,
            },
          }),
        }).catch(() => {});
      }
    }
  };

  // Al terminar un episodio seguimos con el siguiente de la lista (mismo orden
  // que muestra DetailsScreen); si no hay más, volvemos a detalles.
  const handleEnded = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/v1/library/anime-entry/${selectedAnimeId}`);
      const data = await res.json();
      const episodes: any[] = data?.episodes || [];
      const idx = episodes.findIndex((e: any) => String(e.id) === String(selectedEpisodeId));
      const next = idx >= 0 ? episodes[idx + 1] : undefined;
      if (next && next.id != null) {
        useStore.getState().setSelectedEpisode(String(next.id));
        return;
      }
    } catch (err) {
      console.error('auto-next failed', err);
    }
    setScreen('details');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      triggerOSD();
      
      if (!videoRef.current) return;

      if (e.key === ' ' || e.key === 'Enter' || e.keyCode === 13) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
        videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
      } else if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="screen-full player-bg">
      <video 
        ref={videoRef}
        id="tv-video"
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <div className={`player-osd ${!showOSD ? 'hidden' : ''}`}>
        <div className="osd-title">Reproduciendo...</div>
        <div className="progress-bar-bg">
          <div ref={progressFillRef} className="progress-bar-fill" style={{ width: '0%' }}></div>
        </div>
      </div>
    </div>
  );
}
