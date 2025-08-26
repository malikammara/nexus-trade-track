import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Agent, AgentPerformance } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('agent_performance_summary')
        .select('*')
        .order('total_client_revenue', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addAgent = async (agentData: Omit<Agent, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase
        .from('agents')
        .insert([agentData])
        .select()
        .single()

      if (error) throw error
      await fetchAgents() // Refresh the list
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add agent')
    }
  }

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      await fetchAgents() // Refresh the list
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update agent')
    }
  }

  const deleteAgent = async (id: string) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', id)

      if (error) throw error
      setAgents(prev => prev.filter(agent => agent.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete agent')
    }
  }

  const linkClientToAgent = async (clientId: string, agentId: string) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase.rpc('link_client_to_agent', {
        p_client_id: clientId,
        p_agent_id: agentId
      })

      if (error) throw error
      await fetchAgents() // Refresh to update metrics
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to link client to agent')
    }
  }

  const unlinkClientFromAgent = async (clientId: string) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase.rpc('unlink_client_from_agent', {
        p_client_id: clientId
      })

      if (error) throw error
      await fetchAgents() // Refresh to update metrics
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to unlink client from agent')
    }
  }

  const getAgentPerformance = async (agentId?: string): Promise<AgentPerformance[]> => {
    try {
      const { data, error } = await supabase.rpc('get_agent_performance', {
        p_agent_id: agentId || null
      })

      if (error) throw error
      return data || []
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get agent performance')
    }
  }

  const getAgentClients = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('agent_id', agentId)
        .order('overall_margin', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get agent clients')
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  return {
    agents,
    loading,
    error,
    addAgent,
    updateAgent,
    deleteAgent,
    linkClientToAgent,
    unlinkClientFromAgent,
    getAgentPerformance,
    getAgentClients,
    refetch: fetchAgents
  }
}