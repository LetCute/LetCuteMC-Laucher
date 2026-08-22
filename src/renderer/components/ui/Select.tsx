import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string | number
  label: string | React.ReactNode
}

export interface SelectProps {
  value: string | number
  onChange: (value: any) => void
  options: SelectOption[]
  label?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  align?: "left" | "right"
}

export function Select({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
  placeholder = "Chọn...",
  align = "left",
}: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (val: string | number) => {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 w-full relative">
      {label && (
        <span className="text-sm font-medium text-foreground">
          {label}
        </span>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/90 px-3.5 py-2 text-sm text-foreground transition-all duration-200 outline-none text-left select-none",
            "hover:bg-zinc-800/80 hover:border-zinc-700 focus:border-primary/60 focus:ring-2 focus:ring-ring/30",
            isOpen && "border-primary/60 ring-2 ring-ring/30",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2",
              isOpen && "transform rotate-180 text-foreground"
            )}
          />
        </button>

        {isOpen && (
          <div
            className={cn(
              "absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-zinc-700/60 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-thin scrollbar-thumb-zinc-700",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                Không có lựa chọn
              </div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground transition-colors text-left select-none cursor-pointer",
                      "hover:bg-accent/60",
                      isSelected && "bg-primary text-primary-foreground font-medium hover:bg-primary/95"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check className={cn("h-4 w-4 shrink-0 ml-2", isSelected ? "text-primary-foreground" : "text-primary")} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
