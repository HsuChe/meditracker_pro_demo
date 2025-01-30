import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      className={cn("animate-spin", className)}
      {...props}
    >
      <Loader2 
        className={cn(
          "text-muted-foreground",
          {
            "h-4 w-4": size === "sm",
            "h-6 w-6": size === "md",
            "h-8 w-8": size === "lg"
          }
        )} 
      />
      <span className="sr-only">Loading...</span>
    </div>
  )
} 