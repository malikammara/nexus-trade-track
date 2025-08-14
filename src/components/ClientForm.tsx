import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus } from 'lucide-react'
import { Client } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  margin_in: z.number().min(0, 'Margin In must be non-negative'),
  overall_margin: z.number().min(0, 'Overall Margin must be non-negative'),
  invested_amount: z.number().min(0, 'Invested Amount must be non-negative'),
  monthly_revenue: z.number().min(0, 'Monthly Revenue must be non-negative'),
  nots_generated: z.number().min(0, 'NOTs Generated must be non-negative'),
})

type ClientFormData = z.infer<typeof clientSchema>

interface ClientFormProps {
  onSubmit: (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  client?: Client
  isEditing?: boolean
}

export function ClientForm({ onSubmit, client, isEditing = false }: ClientFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { isAdmin } = useAuth()

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
      name: client.name,
      margin_in: client.margin_in,
      overall_margin: client.overall_margin,
      invested_amount: client.invested_amount,
      monthly_revenue: client.monthly_revenue,
      nots_generated: client.nots_generated,
    } : {
      name: '',
      margin_in: 0,
      overall_margin: 0,
      invested_amount: 0,
      monthly_revenue: 0,
      nots_generated: 0,
    }
  })

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        margin_in: client.margin_in,
        overall_margin: client.overall_margin,
        invested_amount: client.invested_amount,
        monthly_revenue: client.monthly_revenue,
        nots_generated: client.nots_generated,
      })
    }
  }, [client, form])

  if (!isAdmin) return null

  const handleSubmit = async (data: ClientFormData) => {
    setLoading(true)
    try {
      await onSubmit(data as Omit<Client, 'id' | 'created_at' | 'updated_at'>)
      setOpen(false)
      form.reset()
    } catch (error) {
      console.error('Failed to submit client:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Client' : 'Add New Client'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Client name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            
            <FormField
              control={form.control}
              name="overall_margin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overall Margin</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditing ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}