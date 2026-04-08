import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const compactTitle = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return "Salvo"
  if (/^sucesso!?$/i.test(text)) return "Salvo"
  if (/salv|atualizad|configurações salvas/i.test(text)) return "Salvo"
  return text
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isDestructive = props.variant === "destructive"
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-0.5 pr-4">
              <ToastTitle>{isDestructive ? title : compactTitle(title)}</ToastTitle>
              {isDestructive && description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
