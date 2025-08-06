import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Client } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  const fetchClients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single()

      if (error) throw error
      setClients(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add client')
    }
  }

  const updateClient = async (id: string, updates: Partial<Client>) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setClients(prev => prev.map(client => client.id === id ? data : client))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update client')
    }
  }

  const deleteClient = async (id: string) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (error) throw error
      setClients(prev => prev.filter(client => client.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete client')
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    deleteClient,
    refetch: fetchClients
  }
}