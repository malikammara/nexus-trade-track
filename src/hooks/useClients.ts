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
        .select(`
          *,
          agent:agents(*)
        `)
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
      const { data, error } = await supabase.rpc('add_client', clientData)

      if (error) throw error
      if (data) setClients(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add client')
    }
  }

  const updateClient = async (id: string, updates: Partial<Client>) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase.rpc('update_client', {
        id,
        name: updates.name ?? null,
        margin_in: updates.margin_in ?? null,
        overall_margin: updates.overall_margin ?? null,
        invested_amount: updates.invested_amount ?? null,
        monthly_revenue: updates.monthly_revenue ?? null
      })

      if (error) throw error
      if (data) setClients(prev => prev.map(client => client.id === id ? data : client))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update client')
    }
  }

  const addDailyMargin = async (
    clientId: string,
    marginIn: number,
    overallMargin: number,
    entryDate?: string
  ) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase.rpc('add_daily_margin', {
        client_id: clientId,
        margin_in: marginIn,
        overall_margin: overallMargin,
        entry_date: entryDate ?? null
      })

      if (error) throw error
      if (data) setClients(prev => prev.map(c => c.id === clientId ? data : c))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add daily margin')
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
    addDailyMargin,
    refetch: fetchClients
  }
}