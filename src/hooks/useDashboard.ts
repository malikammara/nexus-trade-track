import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardStats } from '@/types'

export interface EnhancedDashboardStats extends DashboardStats {
  total_equity: number
  monthly_target_nots: number
  today_nots: number
  today_margin_added: number
  today_withdrawals: number
}

export function useDashboard() {
  const [stats, setStats] = useState<EnhancedDashboardStats | null>(null)
  const [equityTarget, setEquityTarget] = useState<any>(null)
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      
      // Fetch enhanced dashboard stats
      const { data: dashboardData, error: dashboardError } = await supabase
        .from('enhanced_dashboard_stats')
        .select('*')
        .single()

      if (dashboardError) throw dashboardError

      // Fetch equity-based targets
      const { data: targetData, error: targetError } = await supabase
        .rpc('calculate_equity_based_target')

      if (!targetError && targetData?.[0]) {
        setEquityTarget(targetData[0])
      }

      // Fetch retention metrics
      const { data: retentionData, error: retentionError } = await supabase
        .rpc('get_retention_metrics', { days_back: 30 })

      if (!retentionError && retentionData?.[0]) {
        setRetentionMetrics(retentionData[0])
      }

      // Set main stats
      setStats({
        total_clients: dashboardData.total_clients || 0,
        total_margin_in: dashboardData.total_equity || 0, // Using equity as margin
        total_overall_margin: dashboardData.total_equity || 0,
        total_monthly_revenue: dashboardData.total_monthly_revenue || 0,
        total_nots: dashboardData.total_nots || 0,
        target_nots: Math.round(dashboardData.monthly_target_nots || 0),
        progress_percentage: dashboardData.progress_percentage || 0,
        daily_target_nots: Math.round((targetData?.[0]?.daily_target_nots || 0)),
        weekly_target_nots: Math.round((targetData?.[0]?.weekly_target_nots || 0)),
        // Enhanced fields
        total_equity: dashboardData.total_equity || 0,
        monthly_target_nots: dashboardData.monthly_target_nots || 0,
        today_nots: dashboardData.today_nots || 0,
        today_margin_added: dashboardData.today_margin_added || 0,
        today_withdrawals: dashboardData.today_withdrawals || 0
      })
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')

      // Fallback data
      setStats({
        total_clients: 12,
        total_margin_in: 2450000,
        total_overall_margin: 3100000,
        total_monthly_revenue: 890000,
        total_nots: 142,
        target_nots: 441,
        progress_percentage: 32.2,
        daily_target_nots: 20,
        weekly_target_nots: 100,
        total_equity: 3100000,
        monthly_target_nots: 558000,
        today_nots: 5,
        today_margin_added: 25000,
        today_withdrawals: 10000
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
    equityTarget,
    retentionMetrics,
    loading,
    error,
    refetch: fetchDashboardStats
  }
}