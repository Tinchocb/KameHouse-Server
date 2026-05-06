import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { VideoPlayer } from "@/components/ui/streaming/hls-player"

interface VideoPlayerModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    videoUrl: string | null;
    title?: string;
    episodeId?: string;
    onProgress?: (progress: number) => void;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
    hasNextEpisode?: boolean;
    hasPreviousEpisode?: boolean;
    id?: string;
}

function StreamContent({ id, videoUrl, title, onOpenChange, episodeId, onProgress, onNextEpisode, onPreviousEpisode, hasNextEpisode, hasPreviousEpisode }: { 
    id?: string;
    videoUrl: string; 
    title?: string;
    onOpenChange: (open: boolean) => void;
    episodeId?: string;
    onProgress?: (progress: number) => void;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
    hasNextEpisode?: boolean;
    hasPreviousEpisode?: boolean;
}) {
    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <VideoPlayer
              id={id}
              videoUrl={videoUrl}
              title={title}
              onClose={() => onOpenChange(false)}
              onProgress={onProgress}
              episodeId={episodeId}
              onNextEpisode={onNextEpisode}
              onPreviousEpisode={onPreviousEpisode}
              hasNextEpisode={hasNextEpisode}
              hasPreviousEpisode={hasPreviousEpisode}
            />
        </div>
    );
}

export function VideoPlayerModal({
    isOpen,
    onOpenChange,
    videoUrl,
    title,
    episodeId,
    onProgress,
    onNextEpisode,
    onPreviousEpisode,
    hasNextEpisode,
    hasPreviousEpisode,
    id
}: VideoPlayerModalProps) {
    if (!isOpen || !videoUrl) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-screen h-screen p-0 m-0 bg-black border-none overflow-hidden block">
                <StreamContent 
                    id={id}
                    videoUrl={videoUrl} 
                    title={title} 
                    onOpenChange={onOpenChange}
                    episodeId={episodeId}
                    onProgress={onProgress}
                    onNextEpisode={onNextEpisode}
                    onPreviousEpisode={onPreviousEpisode}
                    hasNextEpisode={hasNextEpisode}
                    hasPreviousEpisode={hasPreviousEpisode}
                />
            </DialogContent>
        </Dialog>
    );
}
