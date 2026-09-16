import React, { useCallback, useEffect, useState } from 'react';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useStore } from '../store';

interface PosterCardProps {
  item: any;
  index: number;
  serverUrl: string;
  onSelect: (id: string) => void;
}

const PosterCard = React.memo(({ item, index, serverUrl, onSelect }: PosterCardProps) => {
  const title = item.titleEnglish || item.titleRomaji || item.titleSpanish || 'Anime';
  const { ref, focused } = useFocusable({
    focusKey: `poster-${index}`,
    onEnterPress: () => onSelect(item.id),
  });

  let imgUrl = item.posterImage || '';
  if (imgUrl && !imgUrl.startsWith('http')) {
    imgUrl = serverUrl + imgUrl;
  }

  return (
    <div
      ref={ref as any}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${title}`}
      className={`poster-card ${focused ? 'focused' : ''}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
    >
      <img src={imgUrl} alt={`Póster de ${title}`} loading="lazy" />
      <div className="poster-title">{title}</div>
    </div>
  );
});

export default function HomeScreen() {
  const [items, setItems] = useState<any[]>([]);
  const serverUrl = useStore(state => state.serverUrl);
  const setSelectedAnime = useStore(state => state.setSelectedAnime);
  const setScreen = useStore(state => state.setScreen);

  const { ref, focusKey } = useFocusable({
    focusKey: 'HOME_GRID',
    trackChildren: true,
    autoRestoreFocus: true,
  });

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    fetch(`${serverUrl}/api/v1/library/collection`)
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(data => {
        if (!isMounted) return;
        const flatItems = data?.items || data?.lists?.flatMap((l: any) => l.entries?.map((e: any) => e.media).filter(Boolean)) || [];
        setItems(flatItems);
        if (flatItems.length > 0) {
          timer = setTimeout(() => {
            if (isMounted) setFocus('poster-0');
          }, 100);
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
  }, [serverUrl]);

  const handleSelect = useCallback((id: string) => {
    setSelectedAnime(id);
    setScreen('details');
  }, [setSelectedAnime, setScreen]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref as any} className="screen-full">
        <div className="header">
          <div className="logo-small">Kame<span>House</span></div>
        </div>
        <div className="grid-container">
          {items.map((item, idx) => (
            <PosterCard
              key={item.id || idx}
              index={idx}
              item={item}
              serverUrl={serverUrl}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
