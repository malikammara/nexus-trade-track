import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardStats } from '@/types'

export interface EnhancedDashboardStats extends DashboardStats {
  // Raw business metrics
  total_equity: number
  base_equity: number  // base equity set for current month for target calculation
  total_margin_in: number
  total_withdrawals: number
  today_nots: number
  today_margin_added: number
  today_withdrawals: number

  // Target metrics expressed in NOTs
  monthly_target_nots: number
  daily_target_nots: number
  weekly_target_nots: number
  
  // Month context
  selected_month: number
  selected_year: number
  is_current_month: boolean
}

const NOT_DENOMINATOR = 6000

export function useDashboard(filterMonth?: number, filterYear?: number) {
  const [stats, setStats] = useState<EnhancedDashboardStats | null>(null)
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardStats = async (month?: number, year?: number) => {
    try {
      setLoading(true)

      // Use provided month/year or current month/year
      const targetMonth = month || new Date().getMonth() + 1
      const targetYear = year || new Date().getFullYear()
      const isCurrentMonth = targetMonth === new Date().getMonth() + 1 && targetYear === new Date().getFullYear()
      
      // 1) Get monthly dashboard stats (includes base equity and targets)
      const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_monthly_dashboard_stats', {
        p_month: targetMonth,
        p_year: targetYear
      })
      if (monthlyError) throw monthlyError
      const monthlyStats = monthlyData?.[0] || {}

      // 2) Get cash flow metrics for the target month
      const { data: cashFlowData, error: cashFlowError } = await supabase.rpc('get_cash_flow_metrics_for_month', {
        target_month: targetMonth,
        target_year: targetYear
      })
      if (cashFlowError) throw cashFlowError
      const cashFlow = cashFlowData?.[0] || {}
      
      // 3) Get transactions for the target month to calculate actual NOTs
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('daily_transactions')
        .select('transaction_type, amount, nots_generated, transaction_date')
        .gte('transaction_date', `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`)
        .lt('transaction_date', `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-01`)
      
      if (transactionsError) throw transactionsError
      
      const monthTransactions = transactionsData || []
      const monthlyRevenue = monthTransactions
        .filter(t => t.transaction_type === 'commission')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      
      const monthlyNOTs = monthTransactions
        .filter(t => t.transaction_type === 'commission')
        .reduce((sum, t) => sum + (t.nots_generated || 0), 0)

      // 4) Calculate working days for target month
      const { data: workingDaysData, error: workingDaysError } = await supabase.rpc('get_working_days_in_month', {
        target_year: targetYear,
        target_month: targetMonth
      })
      
      const workingDays = workingDaysData || 22

      // 5) Use stats from the monthly dashboard function
      const currentEquity = monthlyStats.current_equity || 0
      const baseEquity = monthlyStats.base_equity || currentEquity
      const monthlyTargetNOTs = monthlyStats.monthly_target_nots || 0
      const dailyTargetNOTs = monthlyTargetNOTs / workingDays
      const weeklyTargetNOTs = dailyTargetNOTs * 5

      // 6) Get today's activity (only for current month)
      const today = new Date()
      
      const { data: todayData, error: todayError } = await supabase
        .from('daily_transactions')
        .select('transaction_type, amount, nots_generated')
        .eq('transaction_date', today.toISOString().split('T')[0])
      
      const todayTransactions = isCurrentMonth ? (todayData || []) : []
      const todayNots = todayTransactions
        .filter(t => t.transaction_type === 'commission')
        .reduce((sum, t) => sum + (t.nots_generated || 0), 0)
      const todayMarginAdded = todayTransactions
        .filter(t => t.transaction_type === 'margin_add')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      const todayWithdrawals = todayTransactions
        .filter(t => t.transaction_type === 'withdrawal')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      // 7) Retention metrics
      const { data: retentionData, error: retentionError } = await supabase
        .rpc('get_retention_metrics', { days_back: 30 })

      if (!retentionError && retentionData?.[0]) {
        setRetentionMetrics(retentionData[0])
      }

      // 8) Calculate remaining days and required daily average (only for current month)
      const remainingWorkingDays = isCurrentMonth ? (() => {
        let wd = 0
        const current = new Date(today)
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        while (current <= lastDayOfMonth) {
          const dayOfWeek = current.getDay()
          if (dayOfWeek !== 0 && dayOfWeek !== 6) wd++
          current.setDate(current.getDate() + 1)
        }
        return wd
      })() : 0

      const currentNots = monthlyNOTs
      const remainingNots = Math.max(0, monthlyTargetNOTs - currentNots)
      const requiredDailyAvg = remainingWorkingDays > 0 ? remainingNots / remainingWorkingDays : 0

      // 9) Assemble the stats object
      setStats({
        // Base stats
        total_clients: monthlyStats.total_clients || 0,
        total_margin_in: (cashFlow.total_new_deposits || 0) + (cashFlow.total_margin_additions || 0),
        total_overall_margin: currentEquity,
        total_monthly_revenue: monthlyRevenue,
        total_nots: currentNots,

        // Keep these for legacy components that might read them
        target_nots: monthlyTargetNOTs,
        progress_percentage: monthlyTargetNOTs > 0 ? (currentNots / monthlyTargetNOTs) * 100 : 0,

        // Converted targets (NOTs)
        daily_target_nots: dailyTargetNOTs,
        weekly_target_nots: weeklyTargetNOTs,

        // Enhanced fields
        total_equity: currentEquity,
        base_equity: baseEquity,
        total_margin_in: (cashFlow.total_new_deposits || 0) + (cashFlow.total_margin_additions || 0),
        total_withdrawals: cashFlow.total_withdrawals || 0,
        monthly_target_nots: monthlyTargetNOTs, // NOTs
        today_nots: todayNots,
        today_margin_added: todayMarginAdded,
        today_withdrawals: todayWithdrawals,
        
        // Add month context and remaining days info
        selected_month: targetMonth,
        selected_year: targetYear,
        is_current_month: isCurrentMonth,
        remaining_working_days: remainingWorkingDays,
        required_daily_avg: requiredDailyAvg,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')

      // Set error state
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardStats(filterMonth, filterYear)
  }, [filterMonth, filterYear])

  return {
    stats,
    retentionMetrics,
    loading,
    error,
    refetch: () => fetchDashboardStats(filterMonth, filterYear),
  }
}