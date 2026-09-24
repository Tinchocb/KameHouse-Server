import React from 'react';
import { Hourglass, Info } from 'lucide-react';
import type { TimeJump } from './data/timeJumps';

interface TimeJumpDividerProps {
  jump: TimeJump;
}

export const TimeJumpDivider: React.FC<TimeJumpDividerProps> = ({ jump }) => {
  const isContext = jump.kind === 'context';

  return (
    <div
      id={`timejump-${jump.id}`}
      className="relative pl-6 sm:pl-10 my-3 sm:my-4 select-none"
    >
      {/* Node on the continuous spine */}
      <div
        className={`absolute -left-[23px] sm:-left-[31px] top-3.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 shadow-elevation-1 transition-transform ${
          isContext
            ? 'bg-amber-950/90 border-amber-400/50 text-amber-300'
            : 'bg-bg-primary border-brand-accent/50 text-brand-accent'
        }`}
      >
        {isContext ? (
          <Info className="w-3.5 h-3.5" />
        ) : (
          <Hourglass className="w-3 h-3" />
        )}
      </div>

      {/* Divider card with dashed border */}
      <div
        className={`w-full rounded-2xl p-3 sm:p-4 border border-dashed transition-colors duration-200 ${
          isContext
            ? 'bg-amber-950/20 border-amber-500/30'
            : 'bg-bg-primary/40 border-white/15'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Gap pill */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-3xs sm:text-2xs font-bold border shrink-0 ${
                isContext
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-brand-accent/20 text-brand-accent border-brand-accent/40'
              }`}
            >
              {isContext ? <Info className="w-2.5 h-2.5" /> : <Hourglass className="w-2.5 h-2.5" />}
              <span>{jump.gapLabel}</span>
            </span>

            {/* Title */}
            <h4 className="font-display font-bold text-xs sm:text-sm text-white uppercase tracking-wide truncate">
              {jump.title}
            </h4>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-on-surface-variant font-mono leading-relaxed pt-0.5 text-pretty">
          {jump.description}
        </p>
      </div>
    </div>
  );
};
