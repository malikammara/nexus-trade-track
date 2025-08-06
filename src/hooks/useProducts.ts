import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at'>) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single()

      if (error) throw error
      setProducts(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add product')
    }
  }

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setProducts(prev => prev.map(product => product.id === id ? data : product))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update product')
    }
  }

  const deleteProduct = async (id: string) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      setProducts(prev => prev.filter(product => product.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete product')
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts
  }
}