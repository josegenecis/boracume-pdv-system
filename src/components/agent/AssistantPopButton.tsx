import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AgentConsole } from '@/components/agent/AgentConsole';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AssistantPopButtonProps {
  compact?: boolean;
  canOpen: boolean;
  onBlocked: () => void;
}

export function AssistantPopButton({
  compact = false,
  canOpen,
  onBlocked,
}: AssistantPopButtonProps) {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    if (!canOpen) {
      onBlocked();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <span className="assistant-pop-neon">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleOpen}
          className={`relative z-[1] font-extrabold text-[#28164f] hover:bg-white/95 hover:text-[#28164f] ${
            compact ? 'h-8 w-8 rounded-[12px] p-0' : 'h-9 rounded-[12px] px-3'
          }`}
          aria-label="Abrir Pop Agente"
          title="Pop Agente: ajuda e ações no sistema"
        >
          <Sparkles className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
          {!compact && 'Pop Agente'}
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideClose
          className="h-[min(92dvh,900px)] max-w-[min(96vw,1180px)] overflow-hidden border-0 bg-transparent p-0 shadow-2xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Pop Agente</DialogTitle>
            <DialogDescription>
              Suporte inteligente e execução de tarefas permitidas dentro do PopSystem.
            </DialogDescription>
          </DialogHeader>
          <AgentConsole compact className="h-full rounded-2xl" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-20 rounded-xl bg-white/95 text-emerald-950 shadow hover:bg-white"
          >
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
