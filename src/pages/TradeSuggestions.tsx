import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, 
  Target, 
  Calculator,
  DollarSign,
  Search,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { Client, Product } from "@/types";
import { cn } from "@/lib/utils";

interface TradeRecommendation {
  product: Product;
  unitsNeeded: number;
  commissionPerUnit: number;
  totalCommission: number;
  notsGenerated: number;
}

interface ClientTradeAnalysis {
  client: Client;
  dailyTargetNOTs: number;
  requiredCommission: number;
  recommendations: TradeRecommendation[];
}

export default function TradeSuggestions() {
  const { clients, loading: clientsLoading } = useClients();
  const { products, loading: productsLoading } = useProducts();
  const [usdToPkr, setUsdToPkr] = useState(278); // Default USD to PKR rate
  const [searchTerm, setSearchTerm] = useState("");

  // Filter for the three specific products
  const targetProducts = useMemo(() => {
    return products
      .filter(product => {
        const name = product.name.toLowerCase();
  
        // Include only crude, gold, and nasdaq products
        const isTargetType =
          name.includes("crude") ||
          name.includes("gold") ||
          name.includes("nasdaq");
  
        // Exclude ID contracts and "2Nasdaq"
        const isExcluded =
          name.includes(" id ") || name === "2nasdaq";
  
        return isTargetType && !isExcluded;
      });
  }, [products]);
  
  const isExcluded =
    name.includes("id") && (name.includes("gold") || name.includes("crude") || name.includes("silver")) ||
    name === "2nasdaq";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDecimal = (value: number, decimals: number = 2) => {
    return Number(value).toFixed(decimals);
  };

  const calculateClientTradeAnalysis = (client: Client): ClientTradeAnalysis => {
    // Calculate 18% of client equity for monthly target
    const monthlyTargetAmount = client.overall_margin * 0.18;
    const monthlyTargetNOTs = monthlyTargetAmount / 6000;
    const dailyTargetNOTs = monthlyTargetNOTs / 22; // 22 working days
    const requiredCommission = dailyTargetNOTs * 6000;

    const recommendations: TradeRecommendation[] = targetProducts.map(product => {
      const commissionPerUnitPKR = product.commission_usd * usdToPkr;
      const unitsNeeded = Math.ceil(requiredCommission / commissionPerUnitPKR);
      const totalCommission = unitsNeeded * commissionPerUnitPKR;
      const notsGenerated = totalCommission / 6000;

      return {
        product,
        unitsNeeded,
        commissionPerUnit: commissionPerUnitPKR,
        totalCommission,
        notsGenerated
      };
    });

    return {
      client,
      dailyTargetNOTs,
      requiredCommission,
      recommendations
    };
  };

  const clientAnalyses = useMemo(() => {
    return clients
      .filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map(calculateClientTradeAnalysis)
      .sort((a, b) => b.client.overall_margin - a.client.overall_margin);
  }, [clients, targetProducts, usdToPkr, searchTerm]);

  const getProductIcon = (productName: string) => {
    if (productName.toLowerCase().includes('crude')) return '🛢️';
    if (productName.toLowerCase().includes('gold')) return '🥇';
    if (productName.toLowerCase().includes('nasdaq')) return '📈';
    return '📊';
  };

  const getRecommendationStatus = (notsGenerated: number, targetNOTs: number) => {
    const percentage = (notsGenerated / targetNOTs) * 100;
    if (percentage >= 95 && percentage <= 105) return 'perfect';
    if (percentage >= 80 && percentage <= 120) return 'good';
    return 'adjust';
  };

  if (clientsLoading || productsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Trade Suggestions</h1>
          <p className="text-muted-foreground">Loading trade recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Trade Suggestions</h1>
        <p className="text-muted-foreground">
          Help clients achieve their daily NOTs targets with recommended trades
        </p>
      </div>

      {/* Controls */}
        <div className="grid gap-3 md:grid-cols-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        
          {/* USD rate */}
          <div className="flex items-center gap-2">
            <Label htmlFor="usd-rate" className="whitespace-nowrap text-sm">USD → PKR</Label>
            <div className="relative w-full">
              <Input
                id="usd-rate"
                type="number"
                step="0.01"
                value={usdToPkr}
                onChange={(e) => setUsdToPkr(parseFloat(e.target.value) || 278)}
                className="pr-10 h-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                PKR
              </span>
            </div>
          </div>
        </div>
      
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientAnalyses.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Target</CardTitle>
            <Calculator className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatDecimal(
                clientAnalyses.reduce((sum, analysis) => sum + analysis.dailyTargetNOTs, 0) / 
                Math.max(clientAnalyses.length, 1)
              )} NOTs
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Daily Target</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDecimal(
                clientAnalyses.reduce((sum, analysis) => sum + analysis.dailyTargetNOTs, 0)
              )} NOTs
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">USD Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₨{formatDecimal(usdToPkr)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Client Trade Recommendations */}
      <div className="space-y-6">
        {clientAnalyses.map((analysis) => (
          <Card key={analysis.client.id} className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{analysis.client.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Equity: {formatCurrency(analysis.client.overall_margin)} • 
                    Daily Target: {formatDecimal(analysis.dailyTargetNOTs)} NOTs • 
                    Required Commission: {formatCurrency(analysis.requiredCommission)}
                  </p>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {formatDecimal(analysis.dailyTargetNOTs)} NOTs/day
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {analysis.recommendations.map((rec, index) => {
                  const status = getRecommendationStatus(rec.notsGenerated, analysis.dailyTargetNOTs);
                  return (
                    <Card key={index} className={cn(
                      "border-2 transition-colors",
                      status === 'perfect' && "border-trading-profit bg-trading-profit/5",
                      status === 'good' && "border-warning bg-warning/5",
                      status === 'adjust' && "border-muted"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getProductIcon(rec.product.name)}</span>
                            <div>
                              <CardTitle className="text-base">{rec.product.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">
                                ${formatDecimal(rec.product.commission_usd)} per unit
                              </p>
                            </div>
                          </div>
                          {status === 'perfect' && <CheckCircle className="h-5 w-5 text-trading-profit" />}
                          {status === 'good' && <AlertCircle className="h-5 w-5 text-warning" />}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Units Needed:</span>
                            <span className="font-bold text-lg">{rec.unitsNeeded}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Commission/Unit:</span>
                            <span className="font-medium">
                              {formatCurrency(rec.commissionPerUnit)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Commission:</span>
                            <span className="font-medium text-trading-profit">
                              {formatCurrency(rec.totalCommission)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-border">
                            <span className="text-muted-foreground">NOTs Generated:</span>
                            <span className="font-bold text-lg">
                              {formatDecimal(rec.notsGenerated)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="pt-2">
                          <Badge 
                            variant={status === 'perfect' ? 'default' : status === 'good' ? 'secondary' : 'outline'}
                            className="w-full justify-center"
                          >
                            {status === 'perfect' && '🎯 Perfect Match'}
                            {status === 'good' && '✅ Good Option'}
                            {status === 'adjust' && '⚠️ Consider Adjustment'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {clientAnalyses.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="text-center py-8">
            <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No clients found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search criteria" : "Add clients to see trade recommendations"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}