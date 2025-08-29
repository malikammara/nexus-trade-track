import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Calendar as CalendarIcon,
  TrendingUp, 
  Target, 
  Award,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useDailyTransactions } from "@/hooks/useDailyTransactions";

const NOT_DENOMINATOR = 6000;

export default function Analytics() {
  const [dateRange, setDateRange] = useState<{from: Date, to: Date}>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  const { 
    transactions, 
    dailyNOTs, 
    getCashFlowMetrics,
    resetNewClientStatus,
    getEquityBasedTarget, 
    getRetentionMetrics,
    loading 
  } = useDailyTransactions();
  
  const [equityTargetRaw, setEquityTargetRaw] = useState<any>(null);
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null);
  const [cashFlowMetrics, setCashFlowMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [targetData, retentionData, cashFlowData] = await Promise.all([
          getEquityBasedTarget(),
          getRetentionMetrics(30),
          getCashFlowMetrics()
        ]);
        setEquityTargetRaw(targetData);
        setRetentionMetrics(retentionData);
        setCashFlowMetrics(cashFlowData);
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      }
    };

    fetchMetrics();
  }, []);

  // Normalize API target shape (supports row or [row])
  const equityTarget = useMemo(() => {
    if (!equityTargetRaw) return null;
    return Array.isArray(equityTargetRaw) ? equityTargetRaw[0] : equityTargetRaw;
  }, [equityTargetRaw]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

  const formatDecimal = (value: number, decimals: number = 2) =>
    Number(value ?? 0).toFixed(decimals);

  // ---------- Aggregations ----------
  const analytics = useMemo(() => {
    // Use cash flow metrics from the database function
    const newDeposits = cashFlowMetrics?.total_new_deposits || 0;
    const marginIn = cashFlowMetrics?.total_margin_additions || 0;
    const totalWithdrawals = cashFlowMetrics?.total_withdrawals || 0;

    const commission = transactions
      .filter(t => t.transaction_type === "commission")
      .reduce((sum, t) => sum + t.amount, 0);


    const totalNOTs = transactions
      .filter(t => t.transaction_type === "commission")
      .reduce((sum, t) => sum + (t.nots_generated || 0), 0);

    const workingDays = dailyNOTs.filter(d => d.working_day).length;

    const bestDay = dailyNOTs.reduce((best: any, current: any) =>
      current.total_nots_achieved > (best?.total_nots_achieved || 0) ? current : best, null as any
    );

    const dailyAvgNOTs = dailyNOTs.length > 0
      ? dailyNOTs.reduce((sum, d) => sum + (d.total_nots_achieved || 0), 0) / dailyNOTs.length
      : 0;

    // Calculate remaining days and required daily average
    const today = new Date()
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const remainingWorkingDays = (() => {
      let workingDays = 0
      const current = new Date(today)
      while (current <= lastDayOfMonth) {
        const dayOfWeek = current.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
          workingDays++
        }
        current.setDate(current.getDate() + 1)
      }
      return workingDays
    })()

    return {
      newDeposits,
      marginIn,
      totalCommission: commission,
      totalWithdrawals,
      totalNOTs,
      dailyAvgNOTs,
      workingDays,
      bestDay,
      remainingWorkingDays
    };
  }, [transactions, dailyNOTs, cashFlowMetrics]);

  // ---------- Targets (prefer API, fallback to formula) ----------
  const monthlyTargetNOTs = useMemo(() => {
    // Calculate base equity (excluding new deposits and margin-in, adding back withdrawals)
    const currentEquity = equityTarget?.total_equity || 0;
    const baseEquity = currentEquity - analytics.newDeposits - analytics.marginIn + analytics.totalWithdrawals;
    
    // Use base equity for target calculation (18% of base equity)
    return (baseEquity * 0.18) / NOT_DENOMINATOR;
  }, [equityTarget, analytics]);

  const dailyTargetNOTs = useMemo(() => {
    // Use base equity calculation, assume 22 working days
    return monthlyTargetNOTs / 22;
  }, [monthlyTargetNOTs]);

  const remainingTargetNOTs = Math.max(0, monthlyTargetNOTs - analytics.totalNOTs);
  const requiredDailyAvg = analytics.remainingWorkingDays > 0 ? remainingTargetNOTs / analytics.remainingWorkingDays : 0;

  const progressPercentage = monthlyTargetNOTs > 0
    ? (analytics.totalNOTs / monthlyTargetNOTs) * 100
    : 0;

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

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
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
              Target (base equity): {formatDecimal(monthlyTargetNOTs)}
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
              Avg: {formatCurrency(analytics.totalCommission / Math.max(analytics.workingDays, 1))} per day
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Deposits (margin_in)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(analytics.newDeposits)}
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in margin_in column
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Additional Margin</CardTitle>
            <Plus className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(analytics.marginIn)}
            </div>
            <p className="text-xs text-muted-foreground">
              Additional margin from existing clients
            </p>
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
            <p className="text-xs text-muted-foreground">
              Total client withdrawals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress and Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Monthly Progress (Base Equity Method)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">
                  {formatDecimal(analytics.totalNOTs)} / {formatDecimal(monthlyTargetNOTs)}
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
                <span className="text-muted-foreground">Base Equity (targets):</span>
                <span className="font-medium">
                  {formatCurrency(
                    (equityTarget?.total_equity || 0)
                    - analytics.newDeposits
                    - analytics.marginIn
                    + analytics.totalWithdrawals
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Equity:</span>
                <span className="font-medium">
                  {formatCurrency(equityTarget?.total_equity || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Working Days:</span>
                <span className="font-medium">{analytics.workingDays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining NOTs:</span>
                <span className="font-medium">
                  {formatDecimal(Math.max(0, monthlyTargetNOTs - analytics.totalNOTs))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Performance Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-accent rounded-lg">
                <div>
                  <p className="font-medium">Best Day</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.bestDay ? format(new Date(analytics.bestDay.tracking_date), "MMM dd") : "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-trading-profit">
                    {formatDecimal(analytics.bestDay?.total_nots_achieved || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">NOTs</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-border rounded-lg bg-trading-profit/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="h-4 w-4 text-trading-profit" />
                    <span className="text-sm font-medium">New Deposits</span>
                  </div>
                  <p className="text-lg font-bold text-trading-profit">
                    {formatCurrency(analytics.newDeposits)}
                  </p>
                  <p className="text-xs text-muted-foreground">New clients</p>
                </div>

                <div className="p-3 border border-border rounded-lg bg-trading-profit/5">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="h-4 w-4 text-trading-profit" />
                    <span className="text-sm font-medium">Margin In</span>
                  </div>
                  <p className="text-lg font-bold text-trading-profit">
                    {formatCurrency(analytics.marginIn)}
                  </p>
                  <p className="text-xs text-muted-foreground">Existing clients</p>
                </div>

                <div className="p-3 border border-border rounded-lg bg-trading-loss/5">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="h-4 w-4 text-trading-loss" />
                    <span className="text-sm font-medium">Withdrawals</span>
                  </div>
                  <p className="text-lg font-bold text-trading-loss">
                    {formatCurrency(analytics.totalWithdrawals)}
                  </p>
                  <p className="text-xs text-muted-foreground">All withdrawals</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining working days:</span>
                  <span className="font-medium">{analytics.remainingWorkingDays}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Required daily avg:</span>
                  <span className="font-medium text-warning">
                    {formatDecimal(requiredDailyAvg)} NOTs
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retention Rate:</span>
                  <span className="font-medium text-trading-profit">
                    {formatDecimal(retentionMetrics?.retention_rate || 0)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Daily Performance (base equity targets vs achieved) */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Daily Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dailyNOTs.slice(0, 10).map((day: any) => {
              const achieved = day.total_nots_achieved || 0;
              // Use base equity daily target for each working day; zero for weekends
              const targetForDay = day.working_day ? dailyTargetNOTs : 0;
              const delta = achieved - targetForDay;
              const met = achieved >= targetForDay && day.working_day;

              return (
                <div key={day.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {format(new Date(day.tracking_date), "MMM dd, yyyy")}
                    </div>
                    {!day.working_day && (
                      <Badge variant="secondary" className="text-xs">Weekend</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Target (NOTs)</p>
                      <p className="font-medium">{formatDecimal(targetForDay)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Achieved (NOTs)</p>
                      <p className={`font-bold ${met ? 'text-trading-profit' : ''}`}>
                        {formatDecimal(achieved)}
                      </p>
                    </div>
                    <div className="text-right min-w-[110px]">
                      <p className="text-xs text-muted-foreground">Delta</p>
                      <div className="flex items-center justify-end gap-1">
                        {met ? (
                          <Badge variant="default" className="bg-trading-profit text-white">Met</Badge>
                        ) : (
                          <Badge variant="destructive">Shortfall</Badge>
                        )}
                        <span className={met ? "text-trading-profit font-medium" : "text-trading-loss font-medium"}>
                          {delta >= 0 ? "+" : ""}
                          {formatDecimal(delta)}
                        </span>
                      </div>
                    </div>
                    <div className="hidden md:block w-32">
                      {/* tiny inline progress bar for the day */}
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${met ? "bg-trading-profit" : "bg-trading-loss"}`}
                          style={{
                            width: `${Math.min(100, targetForDay > 0 ? (achieved / targetForDay) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
