import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from "lucide-react";
import { useDashboard, EnhancedDashboardStats } from "@/hooks/useDashboard";

export default function Dashboard() {
  const { stats, equityTarget, retentionMetrics, loading, error } = useDashboard();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Performance Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your CS team's trading performance and client management metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_clients}</div>
            <p className="text-xs text-muted-foreground">
              {retentionMetrics?.active_clients || 0} active today
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
            <TrendingUp className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency((stats as EnhancedDashboardStats).total_equity)}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: {formatCurrency((stats as EnhancedDashboardStats).monthly_target_nots)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.total_monthly_revenue)}
            </div>
            <p className="text-xs text-muted-foreground">This month's total</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NOTs Generated</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_nots}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.target_nots} target
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's NOTs</CardTitle>
            <Activity className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {(stats as EnhancedDashboardStats).today_nots}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: {stats.daily_target_nots} daily
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin Added</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency((stats as EnhancedDashboardStats).today_margin_added)}
            </div>
            <p className="text-xs text-muted-foreground">Today's deposits</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withdrawals</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-trading-loss" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-loss">
              {formatCurrency((stats as EnhancedDashboardStats).today_withdrawals)}
            </div>
            <p className="text-xs text-muted-foreground">Today's withdrawals</p>
          </CardContent>
        </Card>
      </div>
      {/* Performance Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              NOTs Progress (18% Equity Target)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current NOTs</span>
                <span className="font-medium">{stats.total_nots} / {stats.target_nots}</span>
              </div>
              <Progress 
                value={stats.progress_percentage} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {stats.progress_percentage.toFixed(1)}% of monthly target achieved
              </p>
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining NOTs needed:</span>
                  <span className="font-medium">{stats.target_nots - stats.total_nots}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily target:</span>
                  <span className="font-medium">{stats.daily_target_nots}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weekly target:</span>
                  <span className="font-medium">{stats.weekly_target_nots}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Team Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Retention Rate</span>
                <span className="font-medium text-trading-profit">
                  {retentionMetrics?.retention_rate?.toFixed(1) || 0}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Trades/Client</span>
                <span className="font-medium">
                  {retentionMetrics?.avg_trades_per_client?.toFixed(1) || 0}
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
            <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h3 className="font-medium mb-2">Add New Client</h3>
              <p className="text-sm text-muted-foreground">Record margin additions, withdrawals, or commissions</p>
            </div>
            
            <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h3 className="font-medium mb-2">View Client Activity</h3>
              <p className="text-sm text-muted-foreground">Check individual client trading activity and performance</p>
            </div>
            
            <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h3 className="font-medium mb-2">Analyze Performance</h3>
              <p className="text-sm text-muted-foreground">View detailed performance analytics and trends</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}