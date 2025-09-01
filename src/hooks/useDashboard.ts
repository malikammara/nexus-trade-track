import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardStats } from '@/types'
import { useMonthlyReset } from '@/hooks/useMonthlyReset'

export interface EnhancedDashboardStats extends DashboardStats {
  // Raw business metrics
  total_equity: number
  base_equity: number  // base equity set for current month for target calculation
  total_margin_in: number
  total_withdrawals: number
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
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getCurrentMonthStats } = useMonthlyReset()

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)

      // 1) Get current month stats with base equity
      const monthlyStats = await getCurrentMonthStats()
      
      // 2) Get cash flow metrics
      const { data: cashFlowData, error: cashFlowError } = await supabase.rpc('get_cash_flow_metrics')
      if (cashFlowError) throw cashFlowError
      const cashFlow = cashFlowData?.[0] || {}

      // 3) Calculate working days for current month
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth() + 1
      const currentYear = currentDate.getFullYear()
      
      const { data: workingDaysData, error: workingDaysError } = await supabase.rpc('get_working_days_in_month', {
        target_year: currentYear,
        target_month: currentMonth
      })
      
      const workingDays = workingDaysData || 22

      // 4) Calculate targets based on base equity (correct NOTs formula)
      const currentEquity = monthlyStats?.current_equity || 0
      const baseEquity = monthlyStats?.base_equity || currentEquity
      
      const monthlyTargetNOTs = (baseEquity * 0.18) / NOT_DENOMINATOR  // Correct: divide by 6000
      const dailyTargetNOTs = monthlyTargetNOTs / workingDays
      const weeklyTargetNOTs = dailyTargetNOTs * 5

      // 5) Retention metrics
      const { data: retentionData, error: retentionError } = await supabase
        .rpc('get_retention_metrics', { days_back: 30 })

      if (!retentionError && retentionData?.[0]) {
        setRetentionMetrics(retentionData[0])
      }

      // 6) Assemble the stats object
      setStats({
        // Base stats
        total_clients: monthlyStats?.total_clients || 0,
        total_margin_in: (cashFlow.total_new_deposits || 0) + (cashFlow.total_margin_additions || 0),
        total_overall_margin: currentEquity,
        total_monthly_revenue: monthlyStats?.total_revenue || 0,
        total_nots: monthlyStats?.achieved_nots || 0,

        // Keep these for legacy components that might read them
        target_nots: monthlyTargetNOTs,
        progress_percentage: monthlyStats?.progress_percentage || 0,

        // Converted targets (NOTs)
        daily_target_nots: dailyTargetNOTs,
        weekly_target_nots: weeklyTargetNOTs,

        // Enhanced fields
        total_equity: currentEquity,
        base_equity: baseEquity,
        total_margin_in: (cashFlow.total_new_deposits || 0) + (cashFlow.total_margin_additions || 0),
        total_withdrawals: cashFlow.total_withdrawals || 0,
        monthly_target_nots: monthlyTargetNOTs, // NOTs
        today_nots: monthlyStats?.today_nots || 0,
        today_margin_added: monthlyStats?.today_margin_added || 0,
        today_withdrawals: monthlyStats?.today_withdrawals || 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')

      // Fallback demo data (all targets here are already in NOTs)
      setStats({
        total_clients: 12,
        total_margin_in: 450000,
        total_overall_margin: 3000000,
        total_monthly_revenue: 0,        // September starts fresh
        total_nots: 0,                   // September starts fresh
        target_nots: 90,                 // (3M * 18%) / 6000 = 90 NOTs
        progress_percentage: 32.2,
        daily_target_nots: 4.09,        // 90 / 22 working days
        weekly_target_nots: 20.45,      // 4.09 * 5 days
        total_equity: 3000000,
        base_equity: 3000000,           // Base for September
        total_margin_in: 450000,
        total_withdrawals: 150000,
        monthly_target_nots: 90,        // Correct NOTs calculation
        today_nots: 0,                  // Fresh start
        today_margin_added: 0,
        today_withdrawals: 0,
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
    retentionMetrics,
    loading,
    error,
    refetch: fetchDashboardStats,
  }
}
