import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AdminPinDialog(props: {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (pin: string) => Promise<void> | void
}) {
  const { open, title, description, confirmLabel, onCancel, onConfirm } = props
  const [pin, setPin] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) setPin('')
  }, [open])

  const submit = async () => {
    try {
      setLoading(true)
      await onConfirm(pin)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || 'PIN do Administrador'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
          <Label>PIN</Label>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            inputMode="numeric"
            placeholder="••••"
            type="password"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || pin.length < 4}>
            {loading ? 'Verificando…' : (confirmLabel || 'Confirmar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
