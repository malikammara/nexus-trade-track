import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AgentEvaluation, EvaluationAlert } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

const ADMIN_EMAIL_ALLOWLIST = new Set([
  'syedyousufhussainzaidi@gmail.com',
  'doctorcrack007@gmail.com',
])

// helpers
const isNonEmpty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0

const firstNonEmpty = (...vals: Array<unknown>) =>
  vals.find(isNonEmpty) ?? null

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

  // Map various possible field names (snake, camel, nested) -> the 3 canonical remark fields.
  const normalizeRemarks = (src: any) => {
    // try many common shapes/aliases and nested forms
    const toneCandidates = [
      src?.tone_remarks,
      src?.toneRemarks,
      src?.tone_clarity_remarks,
      src?.toneClarityRemarks,
      src?.remarks?.tone,
      src?.remarks?.tone_clarity,
      src?.remarks?.toneClarity,
    ]
    const satisfactionCandidates = [
      src?.satisfaction_remarks,
      src?.client_satisfaction_remarks,
      src?.clientSatisfactionRemarks,
      src?.remarks?.satisfaction,
      src?.remarks?.client_satisfaction,
      src?.remarks?.clientSatisfaction,
    ]
    const portfolioCandidates = [
      src?.portfolio_remarks,
      src?.portfolio_revenue_remarks,
      src?.portfolioRevenueRemarks,
      src?.remarks?.portfolio,
      src?.remarks?.portfolio_revenue,
      src?.remarks?.portfolioRevenue,
    ]

    return {
      tone_remarks: firstNonEmpty(...toneCandidates),
      satisfaction_remarks: firstNonEmpty(...satisfactionCandidates),
      portfolio_remarks: firstNonEmpty(...portfolioCandidates),
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
    [key: string]: any
  }) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can add evaluations')
    try {
      const aliases = normalizeRemarks(evaluationData)

      const { data, error } = await supabase.rpc('add_agent_evaluation', {
        p_agent_id: evaluationData.agent_id,
        p_week_start_date: evaluationData.week_start_date,
        p_compliance_score: evaluationData.compliance_score,
        p_tone_clarity_score: evaluationData.tone_clarity_score,
        p_relevance_score: evaluationData.relevance_score,
        p_client_satisfaction_score: evaluationData.client_satisfaction_score,
        p_portfolio_revenue_score: evaluationData.portfolio_revenue_score,

        // ensure undefined/"" -> null, prefer direct field if non-empty, else alias
        p_compliance_remarks: firstNonEmpty(evaluationData.compliance_remarks) ,
        p_tone_remarks: firstNonEmpty(evaluationData.tone_remarks, aliases.tone_remarks),
        p_relevance_remarks: firstNonEmpty(evaluationData.relevance_remarks),
        p_satisfaction_remarks: firstNonEmpty(evaluationData.satisfaction_remarks, aliases.satisfaction_remarks),
        p_portfolio_remarks: firstNonEmpty(evaluationData.portfolio_remarks, aliases.portfolio_remarks),
        p_overall_remarks: firstNonEmpty(evaluationData.overall_remarks),
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
    updates: Partial<AgentEvaluation> & { [key: string]: any }
  ) => {
    if (!canManage) throw new Error('Unauthorized: Only admins can update evaluations')
    try {
      const aliases = normalizeRemarks(updates)

      const { data, error } = await supabase.rpc('update_agent_evaluation', {
        p_evaluation_id: evaluationId,
        p_compliance_score: updates.compliance_score ?? null,
        p_tone_clarity_score: updates.tone_clarity_score ?? null,
        p_relevance_score: updates.relevance_score ?? null,
        p_client_satisfaction_score: updates.client_satisfaction_score ?? null,
        p_portfolio_revenue_score: updates.portfolio_revenue_score ?? null,

        p_compliance_remarks: firstNonEmpty((updates as any).compliance_remarks),
        p_tone_remarks: firstNonEmpty((updates as any).tone_remarks, aliases.tone_remarks),
        p_relevance_remarks: firstNonEmpty((updates as any).relevance_remarks),
        p_satisfaction_remarks: firstNonEmpty((updates as any).satisfaction_remarks, aliases.satisfaction_remarks),
        p_portfolio_remarks: firstNonEmpty((updates as any).portfolio_remarks, aliases.portfolio_remarks),
        p_overall_remarks: firstNonEmpty((updates as any).overall_remarks),
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
      const { error } = await supabase
        .from('agent_evaluations')
        .delete()
        .eq('id', evaluationId)

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
    canManage,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    getAgentEvaluations,
    refetch: fetchEvaluations
  }
}
