import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlyPerformance } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'

export function useMonthlyPerformance() {
  const [monthlyData, setMonthlyData] = useState<MonthlyPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  const fetchMonthlyPerformance = async (month?: number, year?: number) => {
    try {
      setLoading(true)
      let query = supabase
        .from('monthly_performance')
        .select(`
          *,
          client:clients(*)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (month && year) {
        query = query.eq('month', month).eq('year', year)
      }

      const { data, error } = await query

      if (error) throw error
      setMonthlyData(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addMonthlyPerformance = async (performanceData: Omit<MonthlyPerformance, 'id' | 'created_at' | 'client'>) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase
        .from('monthly_performance')
        .insert([performanceData])
        .select(`
          *,
          client:clients(*)
        `)
        .single()

      if (error) throw error
      setMonthlyData(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add monthly performance')
    }
  }

  const updateMonthlyPerformance = async (id: string, updates: Partial<MonthlyPerformance>) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase
        .from('monthly_performance')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          client:clients(*)
        `)
        .single()

      if (error) throw error
      setMonthlyData(prev => prev.map(item => item.id === id ? data : item))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update monthly performance')
    }
  }

  const deleteMonthlyPerformance = async (id: string) => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { error } = await supabase
        .from('monthly_performance')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMonthlyData(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete monthly performance')
    }
  }

  const getMonthlyTeamStats = async (month: number, year: number) => {
    try {
      const { data, error } = await supabase
        .rpc('get_monthly_team_stats', {
          target_month: month,
          target_year: year
        })

      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get monthly team stats')
    }
  }

  useEffect(() => {
    fetchMonthlyPerformance()
  }, [])

  return {
    monthlyData,
    loading,
    error,
    addMonthlyPerformance,
    updateMonthlyPerformance,
    deleteMonthlyPerformance,
    getMonthlyTeamStats,
    refetch: fetchMonthlyPerformance
  }
}