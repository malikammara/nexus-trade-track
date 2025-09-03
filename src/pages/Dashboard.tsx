import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MonthlyResetForm } from "@/components/MonthlyResetForm";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Minus,
  Plus,
  Clock,
  Calendar
} from "lucide-react";
import { useDashboard, EnhancedDashboardStats } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  const { stats, retentionMetrics, loading, error } = useDashboard(selectedMonth, selectedYear)

  const handleMonthYearChange = (month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  };

  const formatDecimal = (value: number, decimals: number = 2) => {
    return Number(value ?? 0).toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Performance Dashboard</h1>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Performance Dashboard</h1>
          <p className="text-muted-foreground text-red-500">
            Error loading dashboard data. Please check your database connection.
          </p>
        </div>
        
        <MonthlyResetForm onSuccess={() => window.location.reload()} />
      </div>
    );
  }

  // ----- BASE EQUITY TARGETS (calculated from base equity, not current equity) -----
  const enhanced = stats as EnhancedDashboardStats;

  const currentEquity = enhanced.total_equity || 0;
  const baseEquity = enhanced.base_equity || 0;
  const totalMarginIn = enhanced.total_margin_in || 0;
  const totalWithdrawals = enhanced.total_withdrawals || 0;
  const currentNots = enhanced.total_nots || 0;

  const monthlyTargetNots = enhanced.monthly_target_nots || 0; // NOTs (based on base equity)
  const dailyTargetNots = enhanced.daily_target_nots || 0;     // NOTs
  const weeklyTargetNots = enhanced.weekly_target_nots || 0;   // NOTs

  const progressPercentage =
    monthlyTargetNots > 0 ? Math.min(100, (currentNots / monthlyTargetNots) * 100) : 0;

  const remainingNots = Math.max(0, monthlyTargetNots - currentNots);
  
  // Get context from stats
  const isCurrentMonth = enhanced.is_current_month
  const remainingWorkingDays = enhanced.remaining_working_days || 0
  const requiredDailyAvg = enhanced.required_daily_avg || 0

  // Small helper to give clickable cards a consistent interaction affordance
  const clickableCard = "transition-shadow hover:shadow-md focus-visible:shadow-md";
  const clickableWrap = "block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CS Falcons Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor CS Falcons team trading performance for {enhanced.selected_month}/{enhanced.selected_year}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <MonthYearPicker
            month={selectedMonth}
            year={selectedYear}
            onMonthYearChange={handleMonthYearChange}
          />
          {isCurrentMonth && (
            <MonthlyResetForm onSuccess={() => window.location.reload()} />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Clients -> /clients */}
        <Link to="/clients" className={clickableWrap} aria-label="Go to Clients">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enhanced.total_clients}</div>
              <p className="text-xs text-muted-foreground">
                {retentionMetrics?.active_clients || 0} active today
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Current Equity -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Equity)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Equity</CardTitle>
              <TrendingUp className="h-4 w-4 text-trading-profit" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-trading-profit">
                {formatCurrency(currentEquity)}
              </div>
              <p className="text-xs text-muted-foreground">
                Base: {formatCurrency(baseEquity)} (for targets)
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Monthly Revenue -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Revenue)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(enhanced.total_monthly_revenue)}
              </div>
              <p className="text-xs text-muted-foreground">This month's total</p>
            </CardContent>
          </Card>
        </Link>

        {/* NOTs Generated -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (NOTs)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NOTs Generated</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDecimal(currentNots)}</div>
              <p className="text-xs text-muted-foreground">
                of {formatDecimal(monthlyTargetNots)} target
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Activity & Flow Tracking (only show for current month) */}
      {isCurrentMonth && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Today's NOTs -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Today’s NOTs)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's NOTs</CardTitle>
              <Activity className="h-4 w-4 text-trading-profit" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-trading-profit">
                {formatDecimal(enhanced.today_nots)}
              </div>
              <p className="text-xs text-muted-foreground">
                Target: {formatDecimal(dailyTargetNots)} daily
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Today's Margin Added -> /clients */}
        <Link to="/clients" className={clickableWrap} aria-label="Go to Clients (Margin Added)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Margin</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-trading-profit" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-trading-profit">
                {formatCurrency(enhanced.today_margin_added)}
              </div>
              <p className="text-xs text-muted-foreground">Today's deposits</p>
            </CardContent>
          </Card>
        </Link>

        {/* Today's Withdrawals -> /clients */}
        <Link to="/clients" className={clickableWrap} aria-label="Go to Clients (Withdrawals)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Withdrawals</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-trading-loss" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-trading-loss">
                {formatCurrency(enhanced.today_withdrawals)}
              </div>
              <p className="text-xs text-muted-foreground">Today's withdrawals</p>
            </CardContent>
          </Card>
        </Link>

        {/* Total Margin In -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Total Margin In)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Margin In</CardTitle>
              <Plus className="h-4 w-4 text-trading-profit" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-trading-profit">
                {formatCurrency(totalMarginIn)}
              </div>
              <p className="text-xs text-muted-foreground">All-time deposits</p>
            </CardContent>
          </Card>
        </Link>

        {/* Total Withdrawals -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Total Withdrawals)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
              <Minus className="h-4 w-4 text-trading-loss" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-trading-loss">
                {formatCurrency(totalWithdrawals)}
              </div>
              <p className="text-xs text-muted-foreground">All-time withdrawals</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      )}

      {/* Performance Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* NOTs Progress (Base Equity Targets) -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Progress)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                NOTs Progress (Base Equity)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current NOTs</span>
                  <span className="font-medium">
                    {formatDecimal(currentNots)} / {formatDecimal(monthlyTargetNots)}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {formatDecimal(progressPercentage)}% of monthly target achieved
                </p>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base equity (targets):</span>
                    <span className="font-medium">{formatCurrency(baseEquity)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current equity (total):</span>
                    <span className="font-medium">{formatCurrency(currentEquity)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total New Margin:</span>
                    <span className="font-medium text-trading-profit">{formatCurrency(totalMarginIn)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total withdrawals:</span>
                    <span className="font-medium text-trading-loss">{formatCurrency(totalWithdrawals)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining NOTs needed:</span>
                    <span className="font-medium">{formatDecimal(remainingNots)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining working days:</span>
                    <span className="font-medium">
                      {isCurrentMonth ? remainingWorkingDays : 'N/A (Historical)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Required daily avg:</span>
                    <span className="font-medium text-warning">
                      {isCurrentMonth ? `${formatDecimal(requiredDailyAvg)} NOTs` : 'N/A (Historical)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Daily target:</span>
                    <span className="font-medium">{formatDecimal(dailyTargetNots)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Weekly target:</span>
                    <span className="font-medium">{formatDecimal(weeklyTargetNots)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Monthly target formula:</span>
                    <span className="font-mono text-xs">(Base Equity × 18%) ÷ 6000</span>
                  </div>
                </div>
                
                {/* Add remaining days info for current month */}
                {isCurrentMonth && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Remaining Time</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Working days left:</span>
                        <span className="font-medium">{remainingWorkingDays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NOTs needed:</span>
                        <span className="font-medium text-warning">
                          {formatDecimal(Math.max(0, monthlyTargetNots - currentNots))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Team Performance & Flow Metrics -> /analytics */}
        <Link to="/analytics" className={clickableWrap} aria-label="Go to Analytics (Team Metrics)">
          <Card className={cn("shadow-card cursor-pointer", clickableCard)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Team Performance & Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Retention Rate</span>
                  <span className="font-medium text-trading-profit">
                    {formatDecimal(retentionMetrics?.retention_rate || 0)}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Trades/Client</span>
                  <span className="font-medium">
                    {formatDecimal(retentionMetrics?.avg_trades_per_client || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Net Flow</span>
                  <span className="font-medium text-trading-profit">
                    {formatCurrency(totalMarginIn - totalWithdrawals)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-medium">Avg Commission/Client</span>
                  <span className="font-bold text-trading-profit">
                    {formatCurrency(retentionMetrics?.avg_commission_per_client || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              to="/clients"
              className={cn(
                "p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
                clickableWrap
              )}
              aria-label="Add New Client"
            >
              <h3 className="font-medium mb-2">Add New Client</h3>
              <p className="text-sm text-muted-foreground">
                Record margin additions, withdrawals, or commissions
              </p>
            </Link>

            <Link
              to="/clients"
              className={cn(
                "p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
                clickableWrap
              )}
              aria-label="View Client Activity"
            >
              <h3 className="font-medium mb-2">View Client Activity</h3>
              <p className="text-sm text-muted-foreground">
                Check individual client trading activity and performance
              </p>
            </Link>

            <Link
              to="/analytics"
              className={cn(
                "p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
                clickableWrap
              )}
              aria-label="Analyze Performance"
            >
              <h3 className="font-medium mb-2">Analyze Performance</h3>
              <p className="text-sm text-muted-foreground">
                View detailed performance analytics and trends
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
