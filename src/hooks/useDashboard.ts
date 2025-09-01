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
      
      // 1) Get cash flow metrics for the target month
      const { data: cashFlowData, error: cashFlowError } = await supabase.rpc('get_cash_flow_metrics_for_month', {
        target_month: targetMonth,
        target_year: targetYear
      })
      if (cashFlowError) throw cashFlowError
      const cashFlow = cashFlowData?.[0] || {}

      // 2) Get monthly performance data
      const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_monthly_team_stats', {
        target_month: targetMonth,
        target_year: targetYear
      })
      if (monthlyError) throw monthlyError
      const monthlyStats = monthlyData?.[0] || {}
      
      // 3) Calculate working days for target month
      const { data: workingDaysData, error: workingDaysError } = await supabase.rpc('get_working_days_in_month', {
        target_year: targetYear,
        target_month: targetMonth
      })
      
      const workingDays = workingDaysData || 22

      // 4) Calculate current and base equity
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('overall_margin, margin_in, is_new_client')
      
      if (clientsError) throw clientsError
      
      const currentEquity = (clientsData || []).reduce((sum, c) => sum + (c.overall_margin || 0), 0)
      
      // Base equity = current equity - new deposits - margin additions + withdrawals
      const newDeposits = cashFlow.total_new_deposits || 0
      const marginAdditions = cashFlow.total_margin_additions || 0
      const totalWithdrawals = cashFlow.total_withdrawals || 0
      const baseEquity = currentEquity - newDeposits - marginAdditions + totalWithdrawals
      
      // 5) Calculate targets based on base equity
      const monthlyTargetNOTs = (baseEquity * 0.18) / NOT_DENOMINATOR
      const dailyTargetNOTs = monthlyTargetNOTs / workingDays
      const weeklyTargetNOTs = dailyTargetNOTs * 5

      // 6) Get today's activity for current month only
      const today = new Date()
      const isCurrentMonth = targetMonth === (today.getMonth() + 1) && targetYear === today.getFullYear()
      
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

      // 7) Retention metrics (only for current month)
      const { data: retentionData, error: retentionError } = await supabase
        .rpc('get_retention_metrics', { days_back: 30 })

      if (!retentionError && retentionData?.[0] && isCurrentMonth) {
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

      const currentNots = monthlyStats.total_nots || 0
      const remainingNots = Math.max(0, monthlyTargetNOTs - currentNots)
      const requiredDailyAvg = remainingWorkingDays > 0 ? remainingNots / remainingWorkingDays : 0

      // 9) Assemble the stats object
      setStats({
        // Base stats
        total_clients: monthlyStats.total_clients || 0,
        total_margin_in: newDeposits + marginAdditions,
        total_overall_margin: currentEquity,
        total_monthly_revenue: monthlyStats.total_revenue || 0,
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
        total_margin_in: newDeposits + marginAdditions,
        total_withdrawals: totalWithdrawals,
        monthly_target_nots: monthlyTargetNOTs, // NOTs
        today_nots: todayNots,
        today_margin_added: todayMarginAdded,
        today_withdrawals: todayWithdrawals,
        
        // Add remaining days info
        remaining_working_days: remainingWorkingDays,
        required_daily_avg: requiredDailyAvg,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')

      // Fallback demo data
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
        remaining_working_days: 0,
        required_daily_avg: 0,
      })
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