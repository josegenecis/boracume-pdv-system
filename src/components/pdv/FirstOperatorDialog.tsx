import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export default function FirstOperatorDialog(props: { open: boolean; onCreated: () => void }) {
  const { open, onCreated } = props
  const { user } = useAuth()
  const { toast } = useToast()
  const [name, setName] = React.useState('')
  const [pin, setPin] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const create = async () => {
    if (!user?.id) return
    if (!name.trim() || pin.trim().length < 4) {
      toast({ title: 'Preencha os campos', description: 'Informe nome e PIN (4-6 dígitos)', variant: 'destructive' })
      return
    }
    try {
      setLoading(true)
      const payload: any = { user_id: user.id, name: name.trim(), pin: pin.trim(), active: true, role: 'admin' }
      let data: any = null
      let error: any = null
      const res1 = await supabase.from('waiters' as any).insert(payload).select('id, name, role, permissions').single()
      data = (res1 as any).data
      error = (res1 as any).error
      if (error && String(error.message || '').includes('role')) {
        const { role, ...fallback } = payload
        const res2 = await supabase.from('waiters' as any).insert(fallback).select('id, name').single()
        data = (res2 as any).data
        error = (res2 as any).error
      }
      if (error) throw error
      const created: any = data
      localStorage.setItem('operator_session', JSON.stringify({
        id: created.id,
        name: created.name,
        role: created.role || 'admin',
        permissions: created.permissions || {},
        user_id: user.id,
        set_at: new Date().toISOString(),
      }))
      toast({ title: 'Operador administrador criado', description: 'Você já pode abrir o caixa e vender.' })
      onCreated()
    } catch (e: any) {
      toast({ title: 'Erro ao criar operador', description: e?.message || 'Verifique tabelas/RLS no Supabase', variant: 'destructive' })
      try { alert(e?.message || 'Erro ao criar operador') } catch {}
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar primeiro operador (Administrador)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João" />
          </div>
          <div className="space-y-2">
            <Label>PIN (4-6 dígitos)</Label>
            <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="Ex: 1234" inputMode="numeric" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={loading}>{loading ? 'Salvando...' : 'Criar e entrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
