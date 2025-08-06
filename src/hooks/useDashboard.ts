import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardStats } from '@/types'

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('dashboard_stats')
        .select('*')
        .single()

      if (error) throw error
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      // Fallback to sample data if database is not set up yet
      setStats({
        total_clients: 12,
        total_margin_in: 2450000,
        total_overall_margin: 3100000,
        total_monthly_revenue: 890000,
        total_nots: 142,
        target_nots: 600,
        progress_percentage: 23.67
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
    loading,
    error,
    refetch: fetchDashboardStats
  }
}