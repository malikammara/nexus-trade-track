import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardStats } from '@/types'

export interface EnhancedDashboardStats extends DashboardStats {
  // Raw business metrics
  total_equity: number
  today_nots: number
  today_margin_added: number
  today_withdrawals: number

  // Target metrics expressed in NOTs (already divided by 6000)
  monthly_target_nots: number
  daily_target_nots: number
  weekly_target_nots: number
}

type EquityTargetRpcRow = {
  total_equity: number
  monthly_target_nots: number   // raw PKR from API
  daily_target_nots: number     // raw PKR from API
  weekly_target_nots: number    // raw PKR from API
}

const NOT_DENOMINATOR = 6000

export function useDashboard() {
  const [stats, setStats] = useState<EnhancedDashboardStats | null>(null)
  const [equityTarget, setEquityTarget] = useState<EquityTargetRpcRow | null>(null) // raw API row (PKR)
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)

      // 1) Main aggregate stats for the dashboard (DB view/table)
      const { data: dashboardData, error: dashboardError } = await supabase
        .from('enhanced_dashboard_stats')
        .select('*')
        .single()

      if (dashboardError) throw dashboardError

      // 2) Targets calculated on the backend (PKR values)
      const { data: targetData, error: targetError } = await supabase
        .rpc('calculate_equity_based_target')

      if (targetError) throw targetError

      const targetRow: EquityTargetRpcRow | undefined = targetData?.[0]
      // Keep the raw row around (PKR) if you need to display currency somewhere
      setEquityTarget(targetRow ?? null)

      // Convert PKR targets -> NOT counts once, centrally
      const monthlyTargetNOTs = (targetRow?.monthly_target_nots ?? 0) / NOT_DENOMINATOR
      const dailyTargetNOTs   = (targetRow?.daily_target_nots ?? 0) / NOT_DENOMINATOR
      const weeklyTargetNOTs  = (targetRow?.weekly_target_nots ?? 0) / NOT_DENOMINATOR

      // 3) Retention / aux metrics
      const { data: retentionData, error: retentionError } = await supabase
        .rpc('get_retention_metrics', { days_back: 30 })

      if (!retentionError && retentionData?.[0]) {
        setRetentionMetrics(retentionData[0])
      }

      // 4) Assemble the stats object the UI consumes (targets already in NOTs)
      setStats({
        // Base stats
        total_clients: dashboardData.total_clients || 0,
        total_margin_in: dashboardData.total_equity || 0,
        total_overall_margin: dashboardData.total_equity || 0,
        total_monthly_revenue: dashboardData.total_monthly_revenue || 0,
        total_nots: dashboardData.total_nots || 0,

        // Keep these for legacy components that might read them
        // (align target_nots to monthly_target_nots so there is one source of truth)
        target_nots: monthlyTargetNOTs,
        progress_percentage: dashboardData.progress_percentage || 0,

        // Converted targets (NOTs)
        daily_target_nots: dailyTargetNOTs,
        weekly_target_nots: weeklyTargetNOTs,

        // Enhanced fields
        total_equity: dashboardData.total_equity || 0,
        monthly_target_nots: monthlyTargetNOTs, // NOTs
        today_nots: dashboardData.today_nots || 0,
        today_margin_added: dashboardData.today_margin_added || 0,
        today_withdrawals: dashboardData.today_withdrawals || 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')

      // Fallback demo data (all targets here are already in NOTs)
      setStats({
        total_clients: 12,
        total_margin_in: 2450000,
        total_overall_margin: 3100000,
        total_monthly_revenue: 890000,
        total_nots: 142,
        target_nots: 441,                // == monthly_target_nots (NOTs)
        progress_percentage: 32.2,
        daily_target_nots: 20,
        weekly_target_nots: 100,
        total_equity: 3100000,
        monthly_target_nots: 441,       // NOTs
        today_nots: 5,
        today_margin_added: 25000,
        today_withdrawals: 10000,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  return {
    stats,
    equityTarget,       // raw PKR target row from API, if you ever want to show currency values
    retentionMetrics,
    loading,
    error,
    refetch: fetchDashboardStats,
  }
}
