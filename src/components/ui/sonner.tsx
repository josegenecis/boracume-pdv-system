import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border border-[#8CC850]/30 bg-[#F4FAEC] px-3 py-2 text-[#245B2B] shadow-md group-[.toaster]:border-[#8CC850]/30 group-[.toaster]:bg-[#F4FAEC] group-[.toaster]:text-[#245B2B]",
          title: "text-xs font-semibold tracking-[0.02em]",
          description: "text-[11px] text-[#245B2B]/80",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
