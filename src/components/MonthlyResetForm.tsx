import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Calendar, RotateCcw, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthProvider'
import { useMonthlyReset } from '@/hooks/useMonthlyReset'
import { useToast } from '@/hooks/use-toast'

const resetSchema = z.object({
  baseEquity: z.number().min(0, 'Base equity must be non-negative'),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2030),
})

type ResetFormData = z.infer<typeof resetSchema>

interface MonthlyResetFormProps {
  onSuccess?: () => void
}

export function MonthlyResetForm({ onSuccess }: MonthlyResetFormProps) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { isAdmin } = useAuth()
  const { setMonthlyBaseEquity, resetMonthlyPerformance } = useMonthlyReset()
  const { toast } = useToast()

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      baseEquity: 0,
      month: currentMonth,
      year: currentYear,
    }
  })

  if (!isAdmin) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const handleSetBaseEquity = async (data: ResetFormData) => {
    setLoading(true)
    try {
      await setMonthlyBaseEquity(data.month, data.year, data.baseEquity)
      toast({
        title: "Base Equity Set",
        description: `Base equity for ${data.month}/${data.year} set to ${formatCurrency(data.baseEquity)}.`,
      })
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set base equity.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMonthlyReset = async (data: ResetFormData) => {
    setLoading(true)
    try {
      // First set the base equity
      await setMonthlyBaseEquity(data.month, data.year, data.baseEquity)
      
      // Then reset monthly performance
      await resetMonthlyPerformance(data.month, data.year)
      
      toast({
        title: "Monthly Reset Complete",
        description: `Successfully reset for ${data.month}/${data.year} with base equity ${formatCurrency(data.baseEquity)}.`,
      })
      
      setOpen(false)
      setConfirmOpen(false)
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset monthly performance.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Calendar className="mr-2 h-4 w-4" />
          Monthly Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Monthly Setup & Reset
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Month</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1"
                      max="12"
                      placeholder="9"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || currentMonth)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="2020"
                      max="2030"
                      placeholder="2024"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || currentYear)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="baseEquity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Equity (PKR)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="1000"
                      placeholder="3000000"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    This will be used for calculating 18% monthly targets
                  </p>
                </FormItem>
              )}
            />
            
            <div className="flex justify-between gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={form.handleSubmit(handleSetBaseEquity)}
                disabled={loading}
              >
                Set Base Equity Only
              </Button>
              
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    type="button" 
                    variant="destructive"
                    disabled={loading}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Month
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Monthly Performance</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset all client revenue and NOTs to zero for the new month. 
                      Current equity will be preserved as base equity. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={form.handleSubmit(handleMonthlyReset)}
                      disabled={loading}
                    >
                      {loading ? 'Resetting...' : 'Reset Month'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}