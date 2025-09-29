import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AgentEvaluation, EvaluationAlert } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

/**
 * Admin model:
 * - Prefer the isAdmin flag from your AuthProvider (e.g., from user metadata).
 * - Fallback to an allowlist (emails) for local dev or when metadata is missing.
 */
const ADMIN_EMAIL_ALLOWLIST = new Set([
  'syedyousufhussainzaidi@gmail.com',
  'doctorcrack007@gmail.com',
])

export function useEvaluations() {
  const [evaluations, setEvaluations] = useState<AgentEvaluation[]>([])
  const [alerts, setAlerts] = useState<EvaluationAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, isAdmin } = useAuth()

  const canManage =
    !!isAdmin || (user?.email ? ADMIN_EMAIL_ALLOWLIST.has(user.email) : false)

  const fetchEvaluations = async (agentId?: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_agent_evaluations', {
        p_agent_id: agentId ?? null,
        p_limit: 50
      })
      if (error) throw error
      setEvaluations(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluation_alerts')
        .select('*')
        .order('total_score', { ascending: true })

      if (error) throw error
      setAlerts(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    }
  }

  const addEvaluation = async (evaluationData: {
    agent_id: string
    week_start_date: string
    compliance_score: number
    tone_clarity_score: number
    relevance_score: number
    client_satisfaction_score: number
    portfolio_revenue_score: number
    compliance_remarks?: string
    tone_remarks?: string
    relevance_remarks?: string
    satisfaction_remarks?: string
    portfolio_remarks?: string
    overall_remarks?: string
  }) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can add evaluations')
    try {
      const { data, error } = await supabase.rpc('add_agent_evaluation', {
        p_agent_id: evaluationData.agent_id,
        p_week_start_date: evaluationData.week_start_date,
        p_compliance_score: evaluationData.compliance_score,
        p_tone_clarity_score: evaluationData.tone_clarity_score,
        p_relevance_score: evaluationData.relevance_score,
        p_client_satisfaction_score: evaluationData.client_satisfaction_score,
        p_portfolio_revenue_score: evaluationData.portfolio_revenue_score,
        p_compliance_remarks: evaluationData.compliance_remarks ?? null,
        p_tone_remarks: evaluationData.tone_remarks ?? null,
        p_relevance_remarks: evaluationData.relevance_remarks ?? null,
        p_satisfaction_remarks: evaluationData.satisfaction_remarks ?? null,
        p_portfolio_remarks: evaluationData.portfolio_remarks ?? null,
        p_overall_remarks: evaluationData.overall_remarks ?? null
      })
      if (error) throw error
      await fetchEvaluations()
      await fetchAlerts()
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add evaluation')
    }
  }

  const updateEvaluation = async (evaluationId: string, updates: Partial<AgentEvaluation>) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can update evaluations')
    try {
      const { data, error } = await supabase.rpc('update_agent_evaluation', {
        p_evaluation_id: evaluationId,
        p_compliance_score: updates.compliance_score ?? null,
        p_tone_clarity_score: updates.tone_clarity_score ?? null,
        p_relevance_score: updates.relevance_score ?? null,
        p_client_satisfaction_score: updates.client_satisfaction_score ?? null,
        p_portfolio_revenue_score: updates.portfolio_revenue_score ?? null,
        p_compliance_remarks: updates.compliance_remarks ?? null,
        p_tone_remarks: updates.tone_remarks ?? null,
        p_relevance_remarks: updates.relevance_remarks ?? null,
        p_satisfaction_remarks: updates.satisfaction_remarks ?? null,
        p_portfolio_remarks: updates.portfolio_remarks ?? null,
        p_overall_remarks: updates.overall_remarks ?? null
      })
      if (error) throw error
      await fetchEvaluations()
      await fetchAlerts()
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update evaluation')
    }
  }

  const deleteEvaluation = async (evaluationId: string) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can delete evaluations')
    try {
      const { error } = await supabase.from('agent_evaluations').delete().eq('id', evaluationId)
      if (error) throw error
      setEvaluations(prev => prev.filter(e => e.id !== evaluationId))
      await fetchAlerts()
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete evaluation')
    }
  }

  const getAgentEvaluations = async (agentId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_agent_evaluations', {
        p_agent_id: agentId,
        p_limit: 20
      })
      if (error) throw error
      return data ?? []
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get agent evaluations')
    }
  }

  useEffect(() => {
    void fetchEvaluations()
    void fetchAlerts()
  }, [])

  return {
    evaluations,
    alerts,
    loading,
    error,
    canManage, // <— expose this
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    getAgentEvaluations,
    refetch: fetchEvaluations
  }
}
