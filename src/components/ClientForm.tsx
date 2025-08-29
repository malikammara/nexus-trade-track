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
import { Checkbox } from '@/components/ui/checkbox'

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  overall_margin: z.number().min(0, 'Overall Margin must be non-negative'),
  is_new_client: z.boolean().default(false),
  margin_in: z.number().min(0, 'Initial deposit must be non-negative').optional(),
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
      overall_margin: client.overall_margin,
      is_new_client: client.is_new_client || false,
      margin_in: client.margin_in || 0,
    } : {
      name: '',
      overall_margin: 0,
      is_new_client: false,
      margin_in: 0,
    }
  })

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        overall_margin: client.overall_margin,
        is_new_client: client.is_new_client || false,
        margin_in: client.margin_in || 0,
      })
    }
  }, [client, form])

  if (!isAdmin) return null

  const handleSubmit = async (data: ClientFormData) => {
    setLoading(true)
    try {
      await onSubmit(data as Omit<Client, 'id' | 'created_at' | 'updated_at'>)
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
              name="is_new_client"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>New Client</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Mark as new client (will auto-reset next month)
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch('is_new_client') && (
              <FormField
                control={form.control}
                name="margin_in"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Deposit (New Client)</FormLabel>
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
                    <p className="text-xs text-muted-foreground">
                      This amount will be tracked as new deposit for cash flow analysis
                    </p>
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="overall_margin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Equity</FormLabel>
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
                   <p className="text-xs text-muted-foreground">
                     Total current equity (including deposits and margin additions)
                   </p>
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