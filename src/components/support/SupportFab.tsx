import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageCircle, X } from 'lucide-react';
import { AgentConsole } from '@/components/agent/AgentConsole';

export default function SupportFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle>Suporte inteligente</DialogTitle>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6">
            <AgentConsole />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

