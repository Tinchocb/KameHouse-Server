import React, { useEffect, useState, useCallback } from 'react';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useStore } from '../store';

const EpisodeItem = React.memo(({ episode, onSelect }: any) => {
  const { ref, focused } = useFocusable({
    focusKey: `episode-${episode.id}`,
    onEnterPress: () => onSelect(episode.id),
  });

  return (
    <div
      ref={ref as any}
      role="button"
      tabIndex={0}
      aria-label={`Episodio ${episode.episodeNumber}: ${episode.title || ''}`}
      className={`episode-item ${focused ? 'focused' : ''}`}
      onClick={() => onSelect(episode.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(episode.id);
        }
      }}
    >
      <div>
        <h3>{episode.title || `Episodio ${episode.episodeNumber}`}</h3>
        <span>Ep {episode.episodeNumber}</span>
      </div>
    </div>
  );
});

export default function DetailsScreen() {
  const [anime, setAnime] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const serverUrl = useStore(state => state.serverUrl);
  const selectedAnimeId = useStore(state => state.selectedAnimeId);
  const setSelectedEpisode = useStore(state => state.setSelectedEpisode);
  const setScreen = useStore(state => state.setScreen);

  const { ref, focusKey } = useFocusable({
    focusKey: 'DETAILS_SCREEN',
    trackChildren: true,
    autoRestoreFocus: true,
  });

  useEffect(() => {
    if (!selectedAnimeId) return;
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    fetch(`${serverUrl}/api/v1/library/anime-entry/${selectedAnimeId}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data && data.media) {
          setAnime(data.media);
          const epList = data.episodes || [];
          setEpisodes(epList);
          if (epList.length > 0) {
            timer = setTimeout(() => {
              if (isMounted) setFocus(`episode-${epList[0].id}`);
            }, 50);
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error(err);
          useStore.getState().setScreen('error');
        }
      });
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [serverUrl, selectedAnimeId]);

  const handleSelectEpisode = useCallback((epId: string) => {
    setSelectedEpisode(epId);
    setScreen('player');
  }, [setSelectedEpisode, setScreen]);

  if (!anime) return <div className="screen-full"><div className="spinner-container"><div className="spinner"></div><div className="status-text">Cargando...</div></div></div>;

  const title = anime.titleSpanish || anime.titleEnglish || anime.titleRomaji || 'Anime';
  let imgUrl = anime.posterImage || '';
  if (imgUrl && !imgUrl.startsWith('http')) imgUrl = serverUrl + imgUrl;
  
  let bgUrl = anime.bannerImage || anime.posterImage || '';
  if (bgUrl && !bgUrl.startsWith('http')) bgUrl = serverUrl + bgUrl;

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref as any} className="screen-full">
        <div className="backdrop" style={{ backgroundImage: `url(${bgUrl})` }}></div>
        <div className="details-content">
          <img className="details-poster" src={imgUrl} alt={title} />
          <div className="details-info">
            <h1>{title}</h1>
            <p className="overview">{anime.overview || 'Sin descripción.'}</p>
            <div className="episodes-list">
              {episodes.map((ep: any) => (
                <EpisodeItem key={ep.id} episode={ep} onSelect={handleSelectEpisode} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
