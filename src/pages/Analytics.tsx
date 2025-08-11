import { useState, useEffect } from "react";
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
  Users,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useDailyTransactions } from "@/hooks/useDailyTransactions";

export default function Analytics() {
  const [dateRange, setDateRange] = useState<{from: Date, to: Date}>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  const { 
    transactions, 
    dailyNOTs, 
    getEquityBasedTarget, 
    getRetentionMetrics,
    loading 
  } = useDailyTransactions();
  
  const [equityTarget, setEquityTarget] = useState<any>(null);
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [targetData, retentionData] = await Promise.all([
          getEquityBasedTarget(),
          getRetentionMetrics(30)
        ]);
        setEquityTarget(targetData);
        setRetentionMetrics(retentionData);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    fetchMetrics();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate analytics from transactions
  const analytics = {
    totalCommission: transactions
      .filter(t => t.transaction_type === 'commission')
      .reduce((sum, t) => sum + t.amount, 0),
    
    totalMarginAdded: transactions
      .filter(t => t.transaction_type === 'margin_add')
      .reduce((sum, t) => sum + t.amount, 0),
    
    totalWithdrawals: transactions
      .filter(t => t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0),
    
    totalNOTs: transactions
      .filter(t => t.transaction_type === 'commission')
      .reduce((sum, t) => sum + t.nots_generated, 0),
    
    dailyAvgNOTs: dailyNOTs.length > 0 
      ? dailyNOTs.reduce((sum, d) => sum + d.total_nots_achieved, 0) / dailyNOTs.length 
      : 0,
    
    workingDays: dailyNOTs.filter(d => d.working_day).length,
    
    bestDay: dailyNOTs.reduce((best, current) => 
      current.total_nots_achieved > (best?.total_nots_achieved || 0) ? current : best, 
      null as any
    )
  };

  const progressPercentage = equityTarget?.monthly_target_nots > 0 
    ? (analytics.totalNOTs / equityTarget.monthly_target_nots) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Detailed analysis of CS team performance and NOTs achievement
          </p>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NOTs Achieved</CardTitle>
            <Target className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {analytics.totalNOTs.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: {equityTarget?.monthly_target_nots?.toFixed(1) || 0}
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
            <CardTitle className="text-sm font-medium">Net Flow</CardTitle>
            <TrendingUp className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(analytics.totalMarginAdded - analytics.totalWithdrawals)}
            </div>
            <p className="text-xs text-muted-foreground">
              Deposits - Withdrawals
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Avg NOTs</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.dailyAvgNOTs.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: {equityTarget?.daily_target_nots?.toFixed(1) || 0}
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
              Monthly Progress (18% Equity Target)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">
                  {analytics.totalNOTs.toFixed(1)} / {equityTarget?.monthly_target_nots?.toFixed(1) || 0}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-trading-profit h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progressPercentage.toFixed(1)}% of monthly target achieved
              </p>
            </div>
            
            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Equity:</span>
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
                  {Math.max(0, (equityTarget?.monthly_target_nots || 0) - analytics.totalNOTs).toFixed(1)}
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
                    {analytics.bestDay ? format(new Date(analytics.bestDay.tracking_date), 'MMM dd') : 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-trading-profit">
                    {analytics.bestDay?.total_nots_achieved?.toFixed(1) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">NOTs</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="h-4 w-4 text-trading-profit" />
                    <span className="text-sm font-medium">Deposits</span>
                  </div>
                  <p className="text-lg font-bold text-trading-profit">
                    {formatCurrency(analytics.totalMarginAdded)}
                  </p>
                </div>

                <div className="p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="h-4 w-4 text-trading-loss" />
                    <span className="text-sm font-medium">Withdrawals</span>
                  </div>
                  <p className="text-lg font-bold text-trading-loss">
                    {formatCurrency(analytics.totalWithdrawals)}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retention Rate:</span>
                  <span className="font-medium text-trading-profit">
                    {retentionMetrics?.retention_rate?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
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
            {dailyNOTs.slice(0, 10).map((day) => (
              <div key={day.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    {format(new Date(day.tracking_date), 'MMM dd, yyyy')}
                  </div>
                  {!day.working_day && (
                    <Badge variant="secondary" className="text-xs">Weekend</Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">NOTs</p>
                    <p className="font-bold text-trading-profit">
                      {day.total_nots_achieved.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Commission</p>
                    <p className="font-medium">
                      {formatCurrency(day.total_commission_pkr)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}