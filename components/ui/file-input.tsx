import React, { type InputHTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface FileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, label = "Choose File", ...props }, ref) => {
    const [fileName, setFileName] = React.useState<string | null>(null)

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      setFileName(file ? file.name : null)
      if (props.onChange) {
        props.onChange(event)
      }
    }

    return (
      <div className={cn("flex items-center space-x-4", className)}>
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById(props.id || "file-input")?.click()}
        >
          {label}
        </Button>
        {fileName ? (
          <span className="text-sm text-muted-foreground">{fileName}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">No file chosen</span>
        )}
        <input type="file" className="hidden" ref={ref} onChange={handleChange} {...props} />
      </div>
    )
  },
)

FileInput.displayName = "FileInput"

export { FileInput }

