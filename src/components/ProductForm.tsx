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
import { Plus } from 'lucide-react'
import { Product } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  commission_usd: z.number().min(0, 'Commission must be non-negative'),
  tick_size: z.number().min(0, 'Tick Size must be positive'),
  tick_value: z.number().min(0, 'Tick Value must be non-negative'),
  price_quote: z.number().min(0, 'Price Quote must be non-negative'),
})

type ProductFormData = z.infer<typeof productSchema>

interface ProductFormProps {
  onSubmit: (data: Omit<Product, 'id' | 'created_at'>) => Promise<void>
  product?: Product
  isEditing?: boolean
}

export function ProductForm({ onSubmit, product, isEditing = false }: ProductFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { isAdmin } = useAuth()

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      name: product.name,
      commission_usd: product.commission_usd,
      tick_size: product.tick_size,
      tick_value: product.tick_value,
      price_quote: product.price_quote,
    } : {
      name: '',
      commission_usd: 0,
      tick_size: 0.01,
      tick_value: 1,
      price_quote: 0,
    }
  })

  if (!isAdmin) return null

  const handleSubmit = async (data: ProductFormData) => {
    setLoading(true)
    try {
      await onSubmit(data as Omit<Product, 'id' | 'created_at'>)
      setOpen(false)
      form.reset()
    } catch (error) {
      console.error('Failed to submit product:', error)
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
            Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="EUR/USD, Bitcoin, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="commission_usd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission (USD)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="25.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="tick_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tick Size</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.00001"
                      placeholder="0.00001"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="tick_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tick Value</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="1.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="price_quote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Price</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="1.0875"
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