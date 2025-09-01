import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import {
  TrendingUp,
  Target,
  Award,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock
} from "lucide-react";
import { useDailyTransactions } from "@/hooks/useDailyTransactions";

const NOT_DENOMINATOR = 6000;

export default function Analytics() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const {
    transactions,
    dailyNOTs,
    getCashFlowMetricsForMonth,
    loading,
  } = useDailyTransactions(selectedMonth, selectedYear);

  const [cashFlowMetrics, setCashFlowMetrics] = useState<any>(null)
  const [monthlyStats, setMonthlyStats] = useState<any>(null)
  const [baseEquity, setBaseEquity] = useState(0)
  const [currentEquity, setCurrentEquity] = useState(0)

  const handleMonthYearChange = (month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Get cash flow metrics for selected month
        const cashFlowData = await getCashFlowMetricsForMonth(selectedMonth, selectedYear)
        setCashFlowMetrics(cashFlowData)
        
        // Get monthly team stats
        const { data: teamStatsData, error: teamStatsError } = await supabase.rpc('get_monthly_team_stats', {
          target_month: selectedMonth,
          target_year: selectedYear
        })
        if (teamStatsError) throw teamStatsError
        setMonthlyStats(teamStatsData?.[0] || {})
        
        // Get current equity from clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('overall_margin, margin_in, is_new_client')
        if (clientsError) throw clientsError
        
        const totalCurrentEquity = (clientsData || []).reduce((sum, c) => sum + (c.overall_margin || 0), 0)
        setCurrentEquity(totalCurrentEquity)
        
        // Calculate base equity (current - new deposits - margin additions + withdrawals)
        const newDeposits = cashFlowData?.total_new_deposits || 0
        const marginAdditions = cashFlowData?.total_margin_additions || 0
        const totalWithdrawals = cashFlowData?.total_withdrawals || 0
        const calculatedBaseEquity = totalCurrentEquity - newDeposits - marginAdditions + totalWithdrawals
        setBaseEquity(calculatedBaseEquity)
      } catch (error) {
        console.error("Failed to fetch metrics:", error)
      }
    }

    fetchMetrics()
  }, [selectedMonth, selectedYear, getCashFlowMetricsForMonth])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

  const formatDecimal = (value: number, decimals: number = 2) =>
    Number(value ?? 0).toFixed(decimals);

  // Calculate targets and remaining days
  const analytics = useMemo(() => {
    const newDeposits = cashFlowMetrics?.total_new_deposits || 0
    const marginIn = cashFlowMetrics?.total_margin_additions || 0
    const totalWithdrawals = cashFlowMetrics?.total_withdrawals || 0

    const commission = transactions
      .filter(t => t.transaction_type === "commission")
      .reduce((sum, t) => sum + t.amount, 0)

    const totalNOTs = transactions
      .filter(t => t.transaction_type === "commission")
      .reduce((sum, t) => sum + (t.nots_generated || 0), 0)

    const workingDays = dailyNOTs.filter(d => d.working_day).length
    
    // Calculate targets based on base equity
    const monthlyTargetNOTs = (baseEquity * 0.18) / NOT_DENOMINATOR
    const dailyTargetNOTs = workingDays > 0 ? monthlyTargetNOTs / workingDays : 0

    const bestDay = dailyNOTs.reduce(
      (best, current) =>
        (current.total_nots_achieved || 0) > (best?.total_nots_achieved || 0)
          ? current
          : best,
      null
    )

    const dailyAvgNOTs =
      dailyNOTs.length > 0
        ? dailyNOTs.reduce((sum, d) => sum + (d.total_nots_achieved || 0), 0) / dailyNOTs.length
        : 0

    // Calculate remaining days and required daily average (only for current month)
    const today = new Date()
    const isCurrentMonth = selectedMonth === (today.getMonth() + 1) && selectedYear === today.getFullYear()
    const remainingWorkingDays = isCurrentMonth ? (() => {
      let wd = 0
      const current = new Date(today)
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      while (current <= lastDayOfMonth) {
        const dayOfWeek = current.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          wd++
        }
        current.setDate(current.getDate() + 1)
      }
      return wd
    })() : 0
    
    const remainingNOTs = Math.max(0, monthlyTargetNOTs - totalNOTs)
    const requiredDailyAvg = remainingWorkingDays > 0 ? remainingNOTs / remainingWorkingDays : 0

    return {
      newDeposits,
      marginIn,
      totalCommission: commission,
      totalWithdrawals,
      totalNOTs,
      monthlyTargetNOTs,
      dailyTargetNOTs,
      dailyAvgNOTs,
      workingDays,
      bestDay,
      remainingWorkingDays,
      remainingNOTs,
      requiredDailyAvg,
      isCurrentMonth,
    }
  }, [transactions, dailyNOTs, cashFlowMetrics, baseEquity, selectedMonth, selectedYear])

  const progressPercentage = analytics.monthlyTargetNOTs > 0 
    ? (analytics.totalNOTs / analytics.monthlyTargetNOTs) * 100 
    : 0
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CS Falcons Analytics</h1>
          <p className="text-muted-foreground">
            Detailed analysis of CS Falcons team performance and NOTs achievement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MonthYearPicker
            month={selectedMonth}
            year={selectedYear}
            onMonthYearChange={handleMonthYearChange}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NOTs Achieved</CardTitle>
            <Target className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatDecimal(analytics.totalNOTs)}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: {formatDecimal(analytics.monthlyTargetNOTs)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg:{" "}
              {formatCurrency(
                analytics.totalCommission / Math.max(analytics.workingDays, 1)
              )}{" "}
              per day
            </p>
          </CardContent>
        </Card>

        {/* Three cash flow categories as requested */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Deposits</CardTitle>
            <Plus className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(analytics.newDeposits)}
            </div>
            <p className="text-xs text-muted-foreground">From new clients</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin In (Deposits)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(analytics.marginIn)}
            </div>
            <p className="text-xs text-muted-foreground">From existing clients</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withdrawals</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-trading-loss" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-loss">
              {formatCurrency(analytics.totalWithdrawals)}
            </div>
            <p className="text-xs text-muted-foreground">Total client withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress and Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              CS Falcons Monthly Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">
                  {formatDecimal(analytics.totalNOTs)} / {formatDecimal(analytics.monthlyTargetNOTs)}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-trading-profit h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDecimal(progressPercentage)}% of monthly target achieved
              </p>
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Equity (for targets):</span>
                <span className="font-medium">
                  {formatCurrency(baseEquity)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Equity:</span>
                <span className="font-medium">
                  {formatCurrency(currentEquity)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Working Days:</span>
                <span className="font-medium">{analytics.workingDays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining NOTs:</span>
                <span className="font-medium">
                  {formatDecimal(analytics.remainingNOTs)}
                </span>
              </div>
              
              {/* Show remaining days info only for current month */}
              {analytics.isCurrentMonth && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining working days:</span>
                    <span className="font-medium">{analytics.remainingWorkingDays}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Required daily avg:</span>
                    <span className="font-medium text-warning">
                      {formatDecimal(analytics.requiredDailyAvg)} NOTs
                    </span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Target formula:</span>
                <span className="font-mono text-xs">(Base Equity × 18%) ÷ 6000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              CS Falcons Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-accent rounded-lg">
                <div>
                  <p className="font-medium">Best Day</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.bestDay
                      ? new Date(analytics.bestDay.tracking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-trading-profit">
                    {formatDecimal(analytics.bestDay?.total_nots_achieved || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">NOTs</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily Target:</span>
                  <span className="font-medium">{formatDecimal(analytics.dailyTargetNOTs)} NOTs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily Average:</span>
                  <span className="font-medium">{formatDecimal(analytics.dailyAvgNOTs)} NOTs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Working Days:</span>
                  <span className="font-medium">{analytics.workingDays}</span>
                </div>
              </div>

              {/* Show remaining time info only for current month */}
              {analytics.isCurrentMonth && (
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Remaining Time</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Working days left:</span>
                    <span className="font-medium">{analytics.remainingWorkingDays}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Required daily avg:</span>
                    <span className="font-medium text-warning">
                      {formatDecimal(analytics.requiredDailyAvg)} NOTs
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Daily Performance */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Daily Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dailyNOTs.slice(0, 10).map((day: any, i: number) => {
              const achieved = day.total_nots_achieved || 0;
              const targetForDay = day.working_day ? analytics.dailyTargetNOTs : 0;
              const delta = achieved - targetForDay;
              const met = achieved >= targetForDay && day.working_day;

              return (
                <div
                  key={day.tracking_date ?? day.id ?? i}
                  className="p-3 rounded-md border border-border space-y-3"
                >
                  {/* Header row: date and status */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {new Date(day.tracking_date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                    <Badge variant={day.working_day ? "default" : "secondary"}>
                      {day.working_day ? "Working Day" : "Weekend"}
                    </Badge>
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Target (NOTs)</p>
                      <p className="font-medium">{formatDecimal(targetForDay)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Achieved (NOTs)</p>
                      <p className={`font-bold ${met ? "text-trading-profit" : ""}`}>
                        {formatDecimal(achieved)}
                      </p>
                    </div>
                    <div className="text-right min-w-[110px]">
                      <p className="text-xs text-muted-foreground">Delta</p>
                      <div className="flex items-center justify-end gap-1">
                        {met ? (
                          <Badge
                            variant="default"
                            className="bg-trading-profit text-white"
                          >
                            Met
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Shortfall</Badge>
                        )}
                        <span
                          className={
                            met
                              ? "text-trading-profit font-medium"
                              : "text-trading-loss font-medium"
                          }
                        >
                          {delta >= 0 ? "+" : ""}
                          {formatDecimal(delta)}
                        </span>
                      </div>
                    </div>
                    <div className="hidden md:block w-32">
                      {/* tiny inline progress bar for the day */}
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            met ? "bg-trading-profit" : "bg-trading-loss"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              targetForDay > 0 ? (achieved / targetForDay) * 100 : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Commission row */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Commission:</span>
                    <span>{formatCurrency(day.total_commission_pkr || 0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
