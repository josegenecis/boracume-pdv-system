import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ReceivableContactType = 'employee' | 'customer' | 'supplier' | 'other';

export interface ReceivableContact {
  id: string;
  name: string;
  contact_type: ReceivableContactType;
  document?: string | null;
  phone?: string | null;
}

const typeLabels: Record<ReceivableContactType, string> = {
  employee: 'Funcionário',
  customer: 'Cliente',
  supplier: 'Fornecedor',
  other: 'Outro',
};

interface Props {
  value: string;
  onChange: (value: string, contact?: ReceivableContact) => void;
}

const ReceivableContactSelect: React.FC<Props> = ({ value, onChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ReceivableContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ReceivableContactType>('employee');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const loadContacts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('receivable_contacts')
      .select('id,name,contact_type,document,phone')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name');
    setLoading(false);

    if (error) {
      toast({
        title: 'Não foi possível carregar os cadastros',
        description: 'Atualize a página e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    setContacts((data || []) as ReceivableContact[]);
  }, [toast, user?.id]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const resetForm = () => {
    setName('');
    setType('employee');
    setDocument('');
    setPhone('');
    setNotes('');
  };

  const saveContact = async () => {
    if (!user?.id || !name.trim()) {
      toast({ title: 'Informe o nome de quem pagará depois', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('receivable_contacts')
      .insert({
        user_id: user.id,
        name: name.trim(),
        contact_type: type,
        document: document.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .select('id,name,contact_type,document,phone')
      .single();
    setSaving(false);

    if (error) {
      toast({
        title: 'Cadastro não realizado',
        description: 'Confira os dados e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    const contact = data as ReceivableContact;
    setContacts((current) => [...current, contact].sort((a, b) => a.name.localeCompare(b.name)));
    onChange(contact.id, contact);
    resetForm();
    setDialogOpen(false);
    toast({ title: 'Cadastro criado', description: `${contact.name} já foi selecionado nesta venda.` });
  };

  return (
    <>
      <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="flex items-center gap-2 font-bold text-amber-950">
          <Clock3 className="h-4 w-4" />
          Quem pagará depois?
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select
            value={value}
            onValueChange={(next) => onChange(next, contacts.find((contact) => contact.id === next))}
          >
            <SelectTrigger className="h-11 bg-white">
              <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione a pessoa ou empresa'} />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name} · {typeLabels[contact.contact_type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="h-11 bg-white" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cadastro
          </Button>
        </div>
        <p className="text-xs text-amber-800">
          A venda será registrada no histórico e ficará pendente em Contas a receber.
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cadastro para pagamento posterior</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(next) => setType(next as ReceivableContactType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CPF/CNPJ (opcional)</Label>
              <Input className="mt-1" value={document} onChange={(event) => setDocument(event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Telefone (opcional)</Label>
              <Input className="mt-1" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveContact()} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar e selecionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReceivableContactSelect;
