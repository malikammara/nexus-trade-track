import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target,
  PieChart,
  BarChart3
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";

export default function Dashboard() {
  const { stats, loading, error } = useDashboard();

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
            <p className="text-xs text-muted-foreground">Active client accounts</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CS Margin In</CardTitle>
            <TrendingUp className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(stats.total_margin_in)}
            </div>
            <p className="text-xs text-muted-foreground">From CS performance</p>
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

      {/* Performance Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Team NOTs Progress
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
                  <span className="text-muted-foreground">Target per client:</span>
                  <span className="font-medium">50 NOTs</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Margin Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">CS Performance Margin</span>
                <span className="font-medium text-trading-profit">
                  {formatCurrency(stats.total_margin_in)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Overall Margin</span>
                <span className="font-medium">
                  {formatCurrency(stats.total_overall_margin)}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm font-medium">CS Contribution</span>
                <span className="font-bold text-trading-profit">
                  {((stats.total_margin_in / stats.total_overall_margin) * 100).toFixed(1)}%
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
              <p className="text-sm text-muted-foreground">Register a new client and start tracking their performance</p>
            </div>
            
            <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h3 className="font-medium mb-2">Update Monthly Data</h3>
              <p className="text-sm text-muted-foreground">Record this month's performance metrics for all clients</p>
            </div>
            
            <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <h3 className="font-medium mb-2">View Product Catalog</h3>
              <p className="text-sm text-muted-foreground">Search trading products and commission rates</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}