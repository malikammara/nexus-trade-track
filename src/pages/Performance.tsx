import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  TrendingUp, 
  Target, 
  Award,
  Users,
  DollarSign,
  BarChart3
} from "lucide-react";

export default function Performance() {
  // Sample performance data - would come from your database
  const monthlyData = [
    {
      month: "January 2024",
      total_margin_in: 450000,
      total_overall_margin: 580000,
      total_revenue: 185000,
      total_nots: 75,
      target_nots: 600,
      progress: 12.5,
      client_count: 12
    },
    {
      month: "December 2023",
      total_margin_in: 380000,
      total_overall_margin: 520000,
      total_revenue: 165000,
      total_nots: 63,
      target_nots: 600,
      progress: 10.5,
      client_count: 12
    },
    {
      month: "November 2023",
      total_margin_in: 520000,
      total_overall_margin: 650000,
      total_revenue: 210000,
      total_nots: 86,
      target_nots: 600,
      progress: 14.3,
      client_count: 11
    }
  ];

  const topPerformers = [
    {
      name: "Ahmed Khan Trading Co.",
      nots: 15,
      margin_in: 185000,
      revenue: 75000,
      progress: 30
    },
    {
      name: "Karachi Investment Group", 
      nots: 12,
      margin_in: 145000,
      revenue: 65000,
      progress: 24
    },
    {
      name: "Lahore Capital Partners",
      nots: 10,
      margin_in: 125000,
      revenue: 55000,
      progress: 20
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currentMonth = monthlyData[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Team Performance</h1>
        <p className="text-muted-foreground">
          Track monthly progress and analyze CS team achievements across all clients
        </p>
      </div>

      {/* Current Month Overview */}
      <Card className="shadow-card border-l-4 border-l-trading-profit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {currentMonth.month} - Current Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">CS Margin Generated</p>
              <p className="text-2xl font-bold text-trading-profit">
                {formatCurrency(currentMonth.total_margin_in)}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(currentMonth.total_revenue)}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">NOTs Generated</p>
              <p className="text-2xl font-bold">{currentMonth.total_nots}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Target Progress</p>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{currentMonth.progress.toFixed(1)}%</p>
                <Progress value={currentMonth.progress} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performers */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-trading-profit" />
              Top Performers (Current Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPerformers.map((performer, index) => (
              <div key={performer.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="font-medium text-sm">{performer.name}</span>
                  </div>
                  <Badge variant="outline">{performer.nots} NOTs</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground ml-8">
                  <div>
                    Margin: <span className="font-medium text-trading-profit">
                      {formatCurrency(performer.margin_in)}
                    </span>
                  </div>
                  <div>
                    Revenue: <span className="font-medium">
                      {formatCurrency(performer.revenue)}
                    </span>
                  </div>
                </div>
                
                <div className="ml-8">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Target Progress</span>
                    <span>{performer.progress}%</span>
                  </div>
                  <Progress value={performer.progress} className="h-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team Targets */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Team Targets & Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-accent rounded-lg">
                <div>
                  <p className="font-medium">Monthly NOTs Target</p>
                  <p className="text-sm text-muted-foreground">50 NOTs per client</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{currentMonth.target_nots}</p>
                  <p className="text-xs text-muted-foreground">Total target</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Achievement</span>
                  <span className="font-medium">{currentMonth.total_nots} / {currentMonth.target_nots}</span>
                </div>
                <Progress value={currentMonth.progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {currentMonth.target_nots - currentMonth.total_nots} NOTs remaining to reach target
                </p>
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commission Threshold:</span>
                  <span className="font-medium">PKR 6,000 = 1 NOT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Clients:</span>
                  <span className="font-medium">{currentMonth.client_count}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly History */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Performance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyData.map((month) => (
              <div key={month.month} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{month.month}</h3>
                  <Badge variant={month.progress >= 15 ? "default" : month.progress >= 10 ? "secondary" : "outline"}>
                    {month.progress.toFixed(1)}% Target
                  </Badge>
                </div>
                
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-trading-profit" />
                    <div>
                      <p className="text-xs text-muted-foreground">CS Margin</p>
                      <p className="font-medium text-sm">{formatCurrency(month.total_margin_in)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="font-medium text-sm">{formatCurrency(month.total_revenue)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">NOTs</p>
                      <p className="font-medium text-sm">{month.total_nots}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Clients</p>
                      <p className="font-medium text-sm">{month.client_count}</p>
                    </div>
                  </div>
                </div>
                
                <Progress value={month.progress} className="h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}