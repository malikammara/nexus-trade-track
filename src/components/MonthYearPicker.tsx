// src/components/MonthYearPicker.tsx
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar, RotateCcw } from 'lucide-react'

type MonthYearPickerProps = {
  /** 1-12 (inclusive) */
  month: number
  /** e.g., 2020 */
  year: number
  onMonthYearChange: (month: number, year: number) => void
  className?: string
  /** allowed floor for year input; defaults to 1970 */
  minYear?: number
  /** allowed ceiling for year input; defaults to current year + 10 */
  maxYear?: number
  /** locale for month names; e.g., 'en-US', 'fr', etc. */
  locale?: string
}

/** Clamp helper */
function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Robust parseInt with fallback */
function parseIntSafe(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Get current (1-based) month & year */
function getTodayMY(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function MonthYearPicker(props: MonthYearPickerProps) {
  const {
    month,
    year,
    onMonthYearChange,
    className,
    minYear = 1970,
    maxYear = new Date().getFullYear() + 10,
    locale,
  } = props

  // local temp state for the popover
  const [tempMonth, setTempMonth] = React.useState<number>(month)
  const [tempYear, setTempYear] = React.useState<number>(year)
  const [open, setOpen] = React.useState(false)

  // keep local state in sync if parent updates props
  React.useEffect(() => {
    setTempMonth(month)
  }, [month])

  React.useEffect(() => {
    setTempYear(year)
  }, [year])

  // Month names from Intl to respect locale; fall back to English.
  const monthNames = React.useMemo(() => {
    try {
      return Array.from({ length: 12 }, (_, i) =>
        new Date(2000, i, 1).toLocaleString(locale || undefined, { month: 'long' })
      )
    } catch {
      return [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ]
    }
  }, [locale])

  // derived validity state
  const isValidMonth = tempMonth >= 1 && tempMonth <= 12
  const isValidYear = tempYear >= minYear && tempYear <= maxYear
  const canApply = isValidMonth && isValidYear

  const apply = () => {
    // guard + clamp to be extra safe
    const safeMonth = clamp(tempMonth, 1, 12)
    const safeYear = clamp(tempYear, minYear, maxYear)
    onMonthYearChange(safeMonth, safeYear)
    setOpen(false)
  }

  const resetToCurrent = () => {
    const { month: m, year: y } = getTodayMY()
    setTempMonth(m)
    setTempYear(y)
    onMonthYearChange(m, y)
    setOpen(false)
  }

  // keyboard UX: Enter=apply, Esc=close
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' && canApply) {
      e.preventDefault()
      apply()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  // IDs for a11y
  const monthId = React.useId()
  const yearId = React.useId()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className} aria-label="Select month and year">
          <Calendar className="mr-2 h-4 w-4" />
          {/* guard against 1-based index */}
          {monthNames[clamp(month, 1, 12) - 1]} {year}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onKeyDown={onKeyDown}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={monthId}>Month</Label>
            <select
              id={monthId}
              value={tempMonth}
              onChange={(e) => setTempMonth(clamp(parseIntSafe(e.target.value, tempMonth), 1, 12))}
              className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
              aria-invalid={!isValidMonth}
            >
              {monthNames.map((name, index) => (
                <option key={index} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={yearId}>Year</Label>
            <Input
              id={yearId}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={minYear}
              max={maxYear}
              value={tempYear}
              onChange={(e) => {
                const next = parseIntSafe(e.target.value, tempYear)
                setTempYear(clamp(next, minYear, maxYear))
              }}
              aria-invalid={!isValidYear}
            />
            <p className="text-xs text-muted-foreground">
              Allowed: {minYear}–{maxYear}
            </p>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={resetToCurrent} size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Current Month
            </Button>
            <Button onClick={apply} size="sm" disabled={!canApply}>
              Apply Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
