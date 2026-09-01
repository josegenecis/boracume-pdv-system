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
  waiter_id?: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  cpf?: string | null;
}

const typeLabels: Record<ReceivableContactType, string> = {
  employee: 'Funcionário',
  customer: 'Cliente',
  supplier: 'Fornecedor',
  other: 'Outro',
};

const normalizeContactName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');

const sortContacts = (contacts: ReceivableContact[]) =>
  [...contacts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

const getContactSaveError = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();

  if (code === '42501' || message.includes('row-level security') || message.includes('sem permissão')) {
    return 'Seu acesso não tem permissão para cadastrar nesta loja. Entre novamente ou peça liberação ao administrador.';
  }
  if (code === '23505' || message.includes('duplicate')) {
    return 'Já existe um cadastro com esses dados nesta loja.';
  }
  if (code === '23503' || message.includes('foreign key')) {
    return 'Não foi possível vincular o cadastro à loja selecionada. Atualize a página e tente novamente.';
  }
  if (code.startsWith('PGRST') || message.includes('schema cache')) {
    return 'O cadastro está sendo atualizado no servidor. Aguarde alguns segundos e tente novamente.';
  }
  if (message.includes('nome')) {
    return 'Informe um nome válido para continuar.';
  }
  return 'Não foi possível salvar agora. Atualize a página e tente novamente.';
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
    const [contactsResult, staffResult] = await Promise.all([
      (supabase as any)
        .from('receivable_contacts')
        .select('id,name,contact_type,document,phone,waiter_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name'),
      (supabase as any)
        .from('waiters')
        .select('id,name,cpf')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name'),
    ]);

    if (contactsResult.error) {
      setLoading(false);
      toast({
        title: 'Não foi possível carregar os cadastros',
        description: 'Atualize a página e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    let nextContacts = (contactsResult.data || []) as ReceivableContact[];
    if (!staffResult.error) {
      const linkedWaiterIds = new Set(nextContacts.map((contact) => contact.waiter_id).filter(Boolean));
      const registeredEmployeeNames = new Set(
        nextContacts
          .filter((contact) => contact.contact_type === 'employee')
          .map((contact) => normalizeContactName(contact.name)),
      );
      const missingStaff = ((staffResult.data || []) as StaffMember[]).filter((staff) => (
        staff.id
        && staff.name?.trim()
        && !linkedWaiterIds.has(staff.id)
        && !registeredEmployeeNames.has(normalizeContactName(staff.name))
      ));

      if (missingStaff.length > 0) {
        const { data: createdContacts, error: syncError } = await (supabase as any)
          .from('receivable_contacts')
          .insert(missingStaff.map((staff) => ({
            user_id: user.id,
            name: staff.name.trim(),
            contact_type: 'employee',
            document: String(staff.cpf || '').replace(/\D/g, '') || null,
            waiter_id: staff.id,
            active: true,
          })))
          .select('id,name,contact_type,document,phone,waiter_id');

        if (syncError) {
          console.warn('[CONTAS_A_RECEBER] Não foi possível sincronizar a equipe:', syncError.message || syncError);
        } else {
          nextContacts = [...nextContacts, ...((createdContacts || []) as ReceivableContact[])];
        }
      }
    } else {
      console.warn('[CONTAS_A_RECEBER] Não foi possível carregar a equipe:', staffResult.error.message || staffResult.error);
    }

    setContacts(sortContacts(nextContacts));
    setLoading(false);
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
      toast({ title: 'Informe o responsável pela conta a receber', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data, error } = await (supabase as any)
      .rpc('create_receivable_contact', {
        p_user_id: user.id,
        p_name: name.trim(),
        p_contact_type: type,
        p_document: document.replace(/\D/g, '') || null,
        p_phone: phone.replace(/\D/g, '') || null,
        p_notes: notes.trim() || null,
      })
      .single();
    setSaving(false);

    if (error) {
      console.error('[CONTAS_A_RECEBER] Falha ao criar cadastro:', {
        code: error.code,
        message: error.message,
      });
      toast({
        title: 'Cadastro não realizado',
        description: getContactSaveError(error),
        variant: 'destructive',
      });
      return;
    }

    const contact = data as ReceivableContact;
    setContacts((current) => sortContacts([...current, contact]));
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
          Responsável pela conta a receber
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
            <DialogTitle>Novo cadastro de contas a receber</DialogTitle>
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
