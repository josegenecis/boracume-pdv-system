import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'default' | 'destructive';

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
};

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export const useConfirmDialog = () => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return ctx;
};

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Confirmar ação',
    description: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'default',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback(async (opts) => {
    setOptions((prev) => ({
      title: opts?.title ?? prev.title ?? 'Confirmar ação',
      description: opts?.description ?? '',
      confirmText: opts?.confirmText ?? 'Confirmar',
      cancelText: opts?.cancelText ?? 'Cancelar',
      variant: opts?.variant ?? 'default',
    }));
    setOpen(true);
    return await new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const resolveAndClose = (value: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    if (resolver) resolver(value);
  };

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) resolveAndClose(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            {options.description ? (
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveAndClose(false)}>
              {options.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resolveAndClose(true)}
              className={cn(
                buttonVariants({ variant: options.variant === 'destructive' ? 'destructive' : 'default' })
              )}
            >
              {options.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  );
};

