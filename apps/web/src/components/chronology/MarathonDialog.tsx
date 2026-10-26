import React from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { MarathonMode } from './data/marathon';

interface MarathonDialogProps {
  open: boolean;
  /** Elementos que ya hay en Mi Lista y episodios del maratón. */
  existingCount: number;
  episodeCount: number;
  onChoose: (mode: MarathonMode | null) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Mi Lista ya tiene contenido: el usuario elige entre añadir al final o reemplazarla. Nada se pierde sin avisar. */
export const MarathonDialog: React.FC<MarathonDialogProps> = ({ open, existingCount, episodeCount, onChoose }) => (
  <Modal
    open={open}
    onOpenChange={(next) => {
      if (!next) onChoose(null);
    }}
    title="Armar el maratón"
    description={`Mi Lista ya tiene ${plural(existingCount, 'elemento', 'elementos')}. El maratón añade ${plural(episodeCount, 'episodio', 'episodios')}.`}
    contentClass="max-w-md"
    footer={
      <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button intent="ghost" onClick={() => onChoose(null)}>
          Cancelar
        </Button>
        <Button intent="secondary" onClick={() => onChoose('replace')}>
          Reemplazar Mi Lista
        </Button>
        <Button intent="primary" onClick={() => onChoose('append')}>
          Añadir al final
        </Button>
      </div>
    }
  >
    <p className="text-sm text-label-2">
      Si la reemplazas, se quita lo que tienes ahora en Mi Lista. Si la añades al final, se conserva y no se repiten los episodios.
    </p>
  </Modal>
);
