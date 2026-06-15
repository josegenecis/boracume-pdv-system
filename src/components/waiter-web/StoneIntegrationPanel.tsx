import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { stoneProvider } from '@/services/payments/stoneProvider';
import type { StoneStatus } from '@/services/payments/PaymentProvider';
import { RefreshCw } from 'lucide-react';

const maskValue = (value?: string) => {
  if (!value) return 'Nao informado';
  if (value.length <= 6) return '******';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
};

export const StoneIntegrationPanel = () => {
  const [status, setStatus] = useState<StoneStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      setStatus(await stoneProvider.getStatus());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  return (
    <div className="space-y-4 rounded-3xl border border-[#DCE6D8] bg-white p-4 text-[#082F23] shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Integração Stone</div>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Use esta tela no POS Android para conferir se a maquininha esta pronta para receber.
          </p>
        </div>
        <Badge className={status?.available ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
          {status?.available ? 'Pronta' : 'Aguardando POS'}
        </Badge>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-[#F4F8F2] p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Status SDK</div>
          <div className="mt-1 font-semibold">{status?.sdkStatus || 'Consultando...'}</div>
        </div>
        <div className="rounded-2xl bg-[#F4F8F2] p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Versao SDK</div>
          <div className="mt-1 font-semibold">{status?.sdkVersion || 'Nao informado'}</div>
        </div>
        <div className="rounded-2xl bg-[#F4F8F2] p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Terminal</div>
          <div className="mt-1 font-semibold">{status?.terminal || status?.deviceId || 'Nao informado'}</div>
        </div>
        <div className="rounded-2xl bg-[#F4F8F2] p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Stone Code</div>
          <div className="mt-1 font-semibold">{status?.stoneCode || 'Nao informado'}</div>
        </div>
        <div className="rounded-2xl bg-[#F4F8F2] p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">SAK</div>
          <div className="mt-1 font-semibold">{maskValue(status?.sak)}</div>
        </div>
        <div className="rounded-2xl bg-[#F4F8F2] p-3">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Ultima comunicacao</div>
          <div className="mt-1 font-semibold">
            {status?.lastCommunication ? new Date(status.lastCommunication).toLocaleString('pt-BR') : 'Nao informado'}
          </div>
        </div>
      </div>

      {status?.message ? <div className="rounded-2xl bg-amber-50 p-3 text-sm leading-5 text-amber-800">{status.message}</div> : null}

      <Button variant="outline" className="h-11 w-full rounded-2xl" onClick={() => void loadStatus()} disabled={loading}>
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Atualizar status da Stone
      </Button>
    </div>
  );
};
