import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthProvider'

export function useMonthlyReset() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  const setMonthlyBaseEquity = async (month: number, year: number, baseEquity: number) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('set_monthly_base_equity', {
        p_month: month,
        p_year: year,
        p_base_equity: baseEquity
      })

      if (error) throw error
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set base equity')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const resetMonthlyPerformance = async (newMonth: number, newYear: number) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('reset_monthly_performance', {
        p_new_month: newMonth,
        p_new_year: newYear
      })

      if (error) throw error
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset monthly performance')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getMonthlyStats = async (month?: number, year?: number) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_monthly_dashboard_stats', {
        p_month: month || null,
        p_year: year || null
      })

      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get monthly stats')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getCurrentMonthStats = async () => {
    try {
      const { data, error } = await supabase
        .from('current_month_dashboard')
        .select('*')
        .single()

      if (error) throw error
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get current month stats')
      throw err
    }
  }

  return {
    loading,
    error,
    setMonthlyBaseEquity,
    resetMonthlyPerformance,
    getMonthlyStats,
    getCurrentMonthStats
  }
}