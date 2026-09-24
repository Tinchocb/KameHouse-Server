export interface SagaBadgeConfig {
  bg: string;
  border: string;
  text: string;
  dot: string;
  icon: string;
}

/** Static saga badge configuration using canonical era tokens */
export const getSagaBadgeConfig = (saga: string, sagaLabel: string): SagaBadgeConfig => {
  if (saga === 'clasico') {
    return {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      icon: '🐉',
    };
  }
  if (saga === 'saiyan-freezer') {
    const isFreezer =
      sagaLabel.toLowerCase().includes('namek') ||
      sagaLabel.toLowerCase().includes('freezer');
    return {
      bg: isFreezer ? 'bg-purple-500/15' : 'bg-orange-500/15',
      border: isFreezer ? 'border-purple-500/30' : 'border-orange-500/30',
      text: isFreezer ? 'text-purple-400' : 'text-orange-400',
      dot: isFreezer ? 'bg-purple-400' : 'bg-orange-400',
      icon: isFreezer ? '🌌' : '💥',
    };
  }
  if (saga === 'cell') {
    return {
      bg: 'bg-sky-500/15',
      border: 'border-sky-500/30',
      text: 'text-sky-400',
      dot: 'bg-sky-400',
      icon: '⚡',
    };
  }
  if (saga === 'buu') {
    return {
      bg: 'bg-pink-500/15',
      border: 'border-pink-500/30',
      text: 'text-pink-400',
      dot: 'bg-pink-400',
      icon: '✨',
    };
  }
  if (saga === 'super') {
    return {
      bg: 'bg-cyan-500/15',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
      dot: 'bg-cyan-400',
      icon: '🪐',
    };
  }
  if (saga === 'daima') {
    return {
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      dot: 'bg-rose-400',
      icon: '✨',
    };
  }
  if (saga === 'gt') {
    return {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      icon: '🌌',
    };
  }
  return {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    icon: '⚔️',
  };
};
