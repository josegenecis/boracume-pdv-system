import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertCircle } from "lucide-react"
import { friendlyErrorMessage, friendlyErrorTitle } from "@/lib/friendly-error"

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
        const friendlyTitle = isDestructive ? friendlyErrorTitle(title) : compactTitle(title)
        const friendlyDescription = isDestructive && typeof description === "string"
          ? friendlyErrorMessage(description)
          : description
        return (
          <Toast key={id} {...props}>
            {isDestructive && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <div className="grid gap-1 pr-5">
              <ToastTitle>{friendlyTitle}</ToastTitle>
              {isDestructive && friendlyDescription && (
                <ToastDescription>{friendlyDescription}</ToastDescription>
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
