// src/pages/Analytics.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  Target,
  Award,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  isSameMonth,
  eachDayOfInterval,
  isWeekend,
} from "date-fns";
import { useDailyTransactions } from "@/hooks/useDailyTransactions";
import { useMonthlyReset } from "@/hooks/useMonthlyReset";

const NOT_DENOMINATOR = 6000;

export default function Analytics() {
  // ── Date range (defaults to current month) ───────────────────────────────────
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const monthStart = useMemo(() => startOfMonth(dateRange.from), [dateRange.from]);
  const monthEnd = useMemo(() => endOfMonth(dateRange.to ?? dateRange.from), [
    dateRange.to,
    dateRange.from,
  ]);

  // ── Data sources ────────────────────────────────────────────────────────────
  const {
    transactions,
    dailyNOTs,
    getCashFlowMetrics,
    getRetentionMetrics,
  } = useDailyTransactions();
  const { getCurrentMonthStats, getMonthlyStats } = useMonthlyReset() as any;

  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null);
  const [cashFlowMetrics, setCashFlowMetrics] = useState<any>(null);

  // ── Stable, guarded fetching (avoids repeated hits in React 18 StrictMode) ──
  const fetchedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${monthStart.toISOString()}_${monthEnd.toISOString()}`;
    if (fetchedKeyRef.current === key) return; // prevent duplicate re-invocations

    fetchedKeyRef.current = key;

    const fetchMetrics = async () => {
      try {
        const selectedMonth = monthStart.getMonth() + 1;
        const selectedYear = monthStart.getFullYear();
        const isCurrentMonth = isSameMonth(monthStart, new Date());
        
        // Get monthly stats - use current month API for current month, monthly stats for others
        const statsPromise = isCurrentMonth 
          ? getCurrentMonthStats()
          : getMonthlyStats(selectedMonth, selectedYear);

        const [monthlyStats, retentionData, cashFlowData] = await Promise.all([
          statsPromise,
          getRetentionMetrics({ from: monthStart, to: monthEnd }),
          getCashFlowMetrics({ from: monthStart, to: monthEnd }),
        ]);

        setMonthlyStats(monthlyStatsData);
        setRetentionMetrics(retentionData);
        setCashFlowMetrics(cashFlowData);
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      }
    };

    fetchMetrics();
  }, [monthStart, monthEnd, getCashFlowMetrics, getRetentionMetrics, getCurrentMonthStats, getMonthlyStats]);

  // Normalize API stats shape (supports row or [row])
  const equityTarget = useMemo(() => {
    if (!monthlyStats) return null;
    return Array.isArray(monthlyStats) ? monthlyStats[0] : monthlyStats;
  }, [monthlyStats]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

  const formatDecimal = (value: number, decimals: number = 2) =>
    Number(value ?? 0).toFixed(decimals);

  // ── Filter transactions for selected month ────
  const txInRange = useMemo(() => {
    return transactions.filter((t: any) => {
      const d = new Date(t.transaction_date ?? t.created_at ?? t.date);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });
  }, [transactions, monthStart, monthEnd]);

  const dailyNOTsInRange = useMemo(() => {
    return dailyNOTs
      .filter((d: any) =>
        isWithinInterval(new Date(d.tracking_date), { start: monthStart, end: monthEnd })
      )
      .sort((a: any, b: any) => +new Date(b.tracking_date) - +new Date(a.tracking_date));
  }, [dailyNOTs, monthStart, monthEnd]);

  // ── Working days for the selected month ─────────────────────────────────────
  const allDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
  );
  const workingDaysCount = useMemo(() => allDays.filter((d) => !isWeekend(d)).length, [allDays]);

  // Compute remaining working days relative to *today* only if the month is current
  const remainingWorkingDays = useMemo(() => {
    const today = new Date();
    if (!isSameMonth(today, monthStart)) return 0; // past/future months: 0 remaining
    return allDays.filter((d) => d >= today && !isWeekend(d)).length;
  }, [allDays, monthStart]);

  // ── Aggregations ────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const newDeposits = cashFlowMetrics?.total_new_deposits || 0;
    const marginIn = cashFlowMetrics?.total_margin_additions || 0;
    const totalWithdrawals = cashFlowMetrics?.total_withdrawals || 0;

    const commission = txInRange
      .filter((t: any) => t.transaction_type === "commission")
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

    const totalNOTs = txInRange
      .filter((t: any) => t.transaction_type === "commission")
      .reduce((sum: number, t: any) => sum + (t.nots_generated || 0), 0);

    const bestDay = dailyNOTsInRange.reduce(
      (best: any, current: any) =>
        (current.total_nots_achieved || 0) > (best?.total_nots_achieved || 0)
          ? current
          : best,
      null as any
    );

    const dailyAvgNOTs =
      dailyNOTsInRange.length > 0
        ? dailyNOTsInRange.reduce((sum: number, d: any) => sum + (d.total_nots_achieved || 0), 0) /
          dailyNOTsInRange.length
        : 0;

    return {
      newDeposits,
      marginIn,
      totalCommission: commission,
      totalWithdrawals,
      totalNOTs,
      dailyAvgNOTs,
      workingDays: workingDaysCount,
      bestDay,
      remainingWorkingDays,
    };
  }, [txInRange, dailyNOTsInRange, cashFlowMetrics, workingDaysCount, remainingWorkingDays]);

  // ── Targets from monthly stats API ───────────────────────────────────────
  const monthlyTargetNOTs = useMemo(() => {
    return equityTarget?.monthly_target_nots || 0;
  }, [equityTarget]);

  const dailyTargetNOTs = useMemo(() => {
    return equityTarget?.daily_target_nots || 0;
  }, [monthlyTargetNOTs, workingDaysCount]);

  const remainingTargetNOTs = Math.max(0, monthlyTargetNOTs - analytics.totalNOTs);
  const requiredDailyAvg = analytics.remainingWorkingDays > 0
    ? remainingTargetNOTs / analytics.remainingWorkingDays
    : 0;

  const progressPercentage = monthlyTargetNOTs > 0 ? (analytics.totalNOTs / monthlyTargetNOTs) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CS Falcons Analytics</h1>
          <p className="text-muted-foreground">Detailed analysis of CS Falcons team performance and NOTs achievement</p>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(monthStart, "LLL dd, y")} - {format(monthEnd, "LLL dd, y")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={monthStart}
                selected={dateRange}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: startOfMonth(range.from), to: endOfMonth(range.to) });
                    fetchedKeyRef.current = null; // force refetch for new month
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
            <div className="text-2xl font-bold text-trading-profit">{formatDecimal(analytics.totalNOTs)}</div>
            <p className="text-xs text-muted-foreground">Target (base equity): {formatDecimal(monthlyTargetNOTs)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalCommission)}</div>
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
            <div className="text-2xl font-bold text-trading-profit">{formatCurrency(analytics.newDeposits)}</div>
            <p className="text-xs text-muted-foreground">Stored in margin_in column</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Additional Margin</CardTitle>
            <Plus className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">{formatCurrency(analytics.marginIn)}</div>
            <p className="text-xs text-muted-foreground">Additional margin from existing clients</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withdrawals</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-trading-loss" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-loss">{formatCurrency(analytics.totalWithdrawals)}</div>
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
                    (equityTarget?.total_equity || 0) - analytics.newDeposits - analytics.marginIn + analytics.totalWithdrawals
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Equity:</span>
                <span className="font-medium">{formatCurrency(equityTarget?.total_equity || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Working Days:</span>
                <span className="font-medium">{analytics.workingDays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining NOTs:</span>
                <span className="font-medium">{formatDecimal(Math.max(0, monthlyTargetNOTs - analytics.totalNOTs))}</span>
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
                  <p className="text-2xl font-bold text-trading-profit">{formatDecimal(analytics.bestDay?.total_nots_achieved || 0)}</p>
                  <p className="text-xs text-muted-foreground">NOTs</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-border rounded-lg bg-trading-profit/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="h-4 w-4 text-trading-profit" />
                    <span className="text-sm font-medium">New Deposits</span>
                  </div>
                  <p className="text-lg font-bold text-trading-profit">{formatCurrency(analytics.newDeposits)}</p>
                  <p className="text-xs text-muted-foreground">New clients</p>
                </div>

                <div className="p-3 border border-border rounded-lg bg-trading-profit/5">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="h-4 w-4 text-trading-profit" />
                    <span className="text-sm font-medium">Margin In</span>
                  </div>
                  <p className="text-lg font-bold text-trading-profit">{formatCurrency(analytics.marginIn)}</p>
                  <p className="text-xs text-muted-foreground">Existing clients</p>
                </div>

                <div className="p-3 border border-border rounded-lg bg-trading-loss/5">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="h-4 w-4 text-trading-loss" />
                    <span className="text-sm font-medium">Withdrawals</span>
                  </div>
                  <p className="text-lg font-bold text-trading-loss">{formatCurrency(analytics.totalWithdrawals)}</p>
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
                  <span className="font-medium text-warning">{formatDecimal(requiredDailyAvg)} NOTs</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retention Rate:</span>
                  <span className="font-medium text-trading-profit">{formatDecimal(retentionMetrics?.retention_rate || 0)}%</span>
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
            {dailyNOTsInRange.slice(0, 10).map((day: any, i: number) => {
              const achieved = day.total_nots_achieved || 0;
              const targetForDay = day.working_day ? dailyTargetNOTs : 0;
              const delta = achieved - targetForDay;
              const met = achieved >= targetForDay && day.working_day;

              return (
                <div key={day.tracking_date ?? day.id ?? i} className="p-3 rounded-md border border-border space-y-3">
                  {/* Header row: base equity */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Base equity (for targets):</span>
                    <div className="flex items-center gap-3">{formatCurrency(equityTarget?.base_equity || 0)}</div>
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Target (NOTs)</p>
                      <p className="font-medium">{formatDecimal(targetForDay)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Achieved (NOTs)</p>
                      <p className={`font-bold ${met ? "text-trading-profit" : ""}`}>{formatDecimal(achieved)}</p>
                    </div>
                    <div className="text-right min-w-[110px]">
                      <p className="text-xs text-muted-foreground">Delta</p>
                      <div className="flex items-center justify-end gap-1">
                        {met ? (
                          <Badge variant="default" className="bg-trading-profit text-white">
                            Met
                          </Badge>
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
                          style={{ width: `${Math.min(100, targetForDay > 0 ? (achieved / targetForDay) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Current equity row */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current equity:</span>
                    <span>{formatCurrency(equityTarget?.current_equity || 0)}</span>
                  </div>

                  {/* Footer: formula */}
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Target formula:</span>
                    <span className="font-mono text-xs">(Base Equity × 18%) ÷ 6000</span>
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
