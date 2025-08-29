import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthProvider'

export interface DailyTransaction {
  id: string
  client_id: string
  transaction_date: string
  transaction_type: 'margin_add' | 'withdrawal' | 'commission'
  amount: number
  description?: string
  nots_generated: number
  created_at: string
  client?: {
    name: string
  }
}

export interface DailyNOTsTracking {
  id: string
  tracking_date: string
  total_nots_achieved: number
  total_commission_pkr: number
  target_nots_daily: number
  working_day: boolean
}

export function useDailyTransactions() {
  const [transactions, setTransactions] = useState<DailyTransaction[]>([])
  const [dailyNOTs, setDailyNOTs] = useState<DailyNOTsTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAdmin } = useAuth()

  const fetchTransactions = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true)
      let query = supabase
        .from('daily_transactions')
        .select(`
          *,
          client:clients(name)
        `)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyNOTs = async (days: number = 30) => {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const { data, error } = await supabase
        .from('daily_nots_tracking')
        .select('*')
        .gte('tracking_date', startDate.toISOString().split('T')[0])
        .order('tracking_date', { ascending: false })

      if (error) throw error
      setDailyNOTs(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily NOTs')
    }
  }

  const addTransaction = async (
    clientId: string,
    transactionType: 'margin_add' | 'withdrawal' | 'commission',
    amount: number,
    description?: string,
    transactionDate?: string
  ) => {
    if (!isAdmin) throw new Error('Unauthorized')

    try {
      const { data, error } = await supabase.rpc('add_daily_transaction_enhanced', {
        p_client_id: clientId,
        p_transaction_type: transactionType,
        p_amount: amount,
        p_description: description || null,
        p_transaction_date: transactionDate || new Date().toISOString().split('T')[0]
      })

      if (error) throw error
      
      // Refresh data
      await fetchTransactions()
      await fetchDailyNOTs()
      
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add transaction')
    }
  }

  const getCashFlowMetrics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_cash_flow_metrics')
      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get cash flow metrics')
    }
  }

  const resetNewClientStatus = async () => {
    if (!isAdmin) throw new Error('Unauthorized')
    
    try {
      const { data, error } = await supabase.rpc('reset_new_client_status_monthly')
      if (error) throw error
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to reset new client status')
    }
  }
  const getEquityBasedTarget = async () => {
    try {
      const { data, error } = await supabase.rpc('calculate_equity_based_target')
      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to calculate targets')
    }
  }

  const getRetentionMetrics = async (daysBack: number = 30) => {
    try {
      const { data, error } = await supabase.rpc('get_retention_metrics', {
        days_back: daysBack
      })
      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get retention metrics')
    }
  }

  const getTodayTransactions = () => {
    const today = new Date().toISOString().split('T')[0]
    return transactions.filter(t => t.transaction_date === today)
  }

  const getTransactionsByType = (type: string, date?: string) => {
    let filtered = transactions.filter(t => t.transaction_type === type)
    if (date) {
      filtered = filtered.filter(t => t.transaction_date === date)
    }
    return filtered
  }

  useEffect(() => {
    fetchTransactions()
    fetchDailyNOTs()
  }, [])

  return {
    transactions,
    dailyNOTs,
    loading,
    error,
    addTransaction,
    getCashFlowMetrics,
    resetNewClientStatus,
    getEquityBasedTarget,
    getRetentionMetrics,
    getTodayTransactions,
    getTransactionsByType,
    refetch: () => {
      fetchTransactions()
      fetchDailyNOTs()
    }
  }
}