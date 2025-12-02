import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AgentEvaluation, EvaluationAlert } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

const ADMIN_EMAIL_ALLOWLIST = new Set([
  'syedyousufhussainzaidi@gmail.com',
  'doctorcrack007@gmail.com',
  'teamfalcons73@gmail.com'
])

export type StpAddEvaluationPayload = {
  agent_id: string
  week_start_date: string            // YYYY-MM-DD (DAILY)
  criteria_scores: Record<string, number>
  criteria_remarks: Record<string, string | null>
  overall_remarks?: string | null
}

export type StpUpdateEvaluationPayload = {
  criteria_scores?: Record<string, number>
  criteria_remarks?: Record<string, string | null>
  overall_remarks?: string | null
}

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
      const { data, error } = await supabase.rpc('stp_get_agent_evaluations', {
        p_agent_id: agentId ?? null,
        p_limit: 50,
      })
      if (error) throw error
      setEvaluations(data ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred while fetching evaluations'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('stp_evaluation_alerts')
        .select('*')
        .order('total_score', { ascending: true })

      if (error) throw error
      setAlerts(data ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch evaluation alerts'
      )
    }
  }

  const addEvaluation = async (evaluationData: StpAddEvaluationPayload) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can add evaluations')
    try {
      const { data, error } = await supabase.rpc('stp_create_agent_evaluation', {
        p_agent_id: evaluationData.agent_id,
        p_week_start_date: evaluationData.week_start_date,
        p_criteria_scores: evaluationData.criteria_scores,
        p_criteria_remarks: evaluationData.criteria_remarks,
        p_overall_remarks: evaluationData.overall_remarks ?? null,
      })

      if (error) throw error
      await fetchEvaluations()
      await fetchAlerts()
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add evaluation')
    }
  }

  const updateEvaluation = async (
    evaluationId: string,
    updates: StpUpdateEvaluationPayload
  ) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can update evaluations')
    try {
      const { data, error } = await supabase.rpc('stp_update_agent_evaluation', {
        p_evaluation_id: evaluationId,
        p_criteria_scores: updates.criteria_scores ?? null,
        p_criteria_remarks: updates.criteria_remarks ?? null,
        p_overall_remarks: updates.overall_remarks ?? null,
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
      const { error } = await supabase.rpc('stp_delete_agent_evaluation', {
        p_evaluation_id: evaluationId,
      })

      if (error) throw error
      setEvaluations(prev => prev.filter(e => e.id !== evaluationId))
      await fetchAlerts()
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete evaluation')
    }
  }

  const getAgentEvaluations = async (agentId: string) => {
    try {
      const { data, error } = await supabase.rpc('stp_get_agent_evaluations', {
        p_agent_id: agentId,
        p_limit: 20,
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
    canManage,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    getAgentEvaluations,
    refetch: fetchEvaluations,
  }
}
