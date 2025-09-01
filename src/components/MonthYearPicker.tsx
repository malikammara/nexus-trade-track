import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar, RotateCcw } from 'lucide-react'

interface MonthYearPickerProps {
  month: number
  year: number
  onMonthYearChange: (month: number, year: number) => void
  className?: string
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function MonthYearPicker({ month, year, onMonthYearChange, className }: MonthYearPickerProps) {
  const [tempMonth, setTempMonth] = useState(month)
  const [tempYear, setTempYear] = useState(year)
  const [open, setOpen] = useState(false)

  const handleApply = () => {
    onMonthYearChange(tempMonth, tempYear)
    setOpen(false)
  }

  const handleReset = () => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    setTempMonth(currentMonth)
    setTempYear(currentYear)
    onMonthYearChange(currentMonth, currentYear)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className}>
          <Calendar className="mr-2 h-4 w-4" />
          {monthNames[month - 1]} {year}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <select
              id="month"
              value={tempMonth}
              onChange={(e) => setTempMonth(parseInt(e.target.value))}
              className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
            >
              {monthNames.map((name, index) => (
                <option key={index} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              min="2020"
              max="2030"
              value={tempYear}
              onChange={(e) => setTempYear(parseInt(e.target.value) || new Date().getFullYear())}
            />
          </div>
          
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={handleReset} size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Current Month
            </Button>
            <Button onClick={handleApply} size="sm">
              Apply Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}