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
import { supabase } from "@/lib/supabase";

const NOT_DENOMINATOR = 6000;

type ProductSlice = {
  product: Product;
  units: number;
  commissionPerUnit: number; // PKR
  commissionTotal: number;   // PKR
  nots: number;
};

type DiversifiedOption = {
  label: string;
  slices: ProductSlice[];
  totalCommission: number;   // PKR
  totalNOTs: number;
  fit: "perfect" | "good" | "adjust";
  deltaNOTs: number;         // totalNOTs - targetNOTs
};

interface ClientDiversifiedAnalysis {
  client: Client;
  dailyTargetNOTs: number;
  requiredCommission: number; // PKR
  options: DiversifiedOption[];
}

export default function TradeSuggestions() {
  const { clients, loading: clientsLoading } = useClients();
  const { products, loading: productsLoading } = useProducts();

  const [usdToPkr, setUsdToPkr] = useState(283);
  const [searchTerm, setSearchTerm] = useState("");

  // Same API as useDashboard for consistency
  const [orgDailyTargetNOTs, setOrgDailyTargetNOTs] = useState<number>(0);
  const [totalEquity, setTotalEquity] = useState<number>(0);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        setApiError(null);
        const { data, error } = await supabase.rpc("calculate_equity_based_target");
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        const apiTotalEquity = row?.total_equity ?? 0;
        const apiDailyPKR = row?.daily_target_nots ?? 0; // backend returns PKR/day
        setTotalEquity(apiTotalEquity);
        setOrgDailyTargetNOTs(apiDailyPKR / NOT_DENOMINATOR);
      } catch (e: any) {
        setApiError(e?.message || "Failed to fetch daily target");
        setTotalEquity(0);
        setOrgDailyTargetNOTs(0);
      }
    };
    fetchTargets();
  }, []);

  // Filter to core instruments: crude, gold, nasdaq; exclude " id " and "2nasdaq"
  const targetProducts = useMemo(() => {
    return products.filter((p) => {
      const n = (p.name || "").toLowerCase();
      const isCore = n.includes("crude") || n.includes("gold") || n.includes("nasdaq");
      const excluded = n.includes(" id ") || n === "2nasdaq";
      return isCore && !excluded;
    });
  }, [products]);

  const pickCore = useMemo(() => {
    const pick = (keyword: string) =>
      targetProducts.find((p) => (p.name || "").toLowerCase().includes(keyword));
    const nasdaq = pick("nasdaq") || null;
    const gold = pick("gold") || null;
    const crude = pick("crude") || null;
    // Only keep non-null
    return [nasdaq, gold, crude].filter(Boolean) as Product[];
  }, [targetProducts]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

  const formatDecimal = (value: number, decimals: number = 2) =>
    Number(value ?? 0).toFixed(decimals);

  // --- Helpers ---
  const getProductIcon = (productName: string) => {
    const n = productName.toLowerCase();
    if (n.includes("crude")) return "🛢️";
    if (n.includes("gold")) return "🥇";
    if (n.includes("nasdaq")) return "📈";
    return "📊";
  };

  const fitBadge = (ratioPct: number): "perfect" | "good" | "adjust" => {
    if (ratioPct >= 95 && ratioPct <= 105) return "perfect";
    if (ratioPct >= 80 && ratioPct <= 120) return "good";
    return "adjust";
  };

  // Build 3 diversified portfolios: A (50/30/20 N/G/C), B (40/40/20 G/N/C), C (equal)
  const allocationSets = useMemo(() => {
    // Default weights for Nasdaq, Gold, Crude (in that order)
    const A = { label: "Option A", weights: { nasdaq: 0.5, gold: 0.3, crude: 0.2 } };
    const B = { label: "Option B", weights: { nasdaq: 0.4, gold: 0.4, crude: 0.2 } };
    const C = { label: "Option C", weights: { nasdaq: 1/3, gold: 1/3, crude: 1/3 } };
    return [A, B, C];
  }, []);

  // Normalize/renormalize weights over AVAILABLE instruments for an option
  const getWeightsForAvailable = (option: typeof allocationSets[number], available: Product[]) => {
    const mapKey = (p: Product) => {
      const n = p.name.toLowerCase();
      if (n.includes("nasdaq")) return "nasdaq" as const;
      if (n.includes("gold")) return "gold" as const;
      if (n.includes("crude")) return "crude" as const;
      return "other" as const;
    };

    const weightsRaw = available.map((p) => option.weights[mapKey(p)] ?? 0);
    const sum = weightsRaw.reduce((s, w) => s + w, 0);
    // If none matched (edge), split equally
    const normalized = sum > 0 ? weightsRaw.map((w) => w / sum) : available.map(() => 1 / Math.max(available.length, 1));
    return normalized; // array aligned to `available`
  };

  // Build diversified options for a client based on equity share and API daily target
  const buildOptionsForClient = (client: Client): ClientDiversifiedAnalysis => {
    const share = totalEquity > 0 ? (client.overall_margin || 0) / totalEquity : 0;
    const dailyTargetNOTs = orgDailyTargetNOTs * share;
    const requiredPKR = dailyTargetNOTs * NOT_DENOMINATOR;

    const available = pickCore;
    // If we somehow don't have any target products, return empty options
    if (available.length === 0) {
      return {
        client,
        dailyTargetNOTs,
        requiredCommission: requiredPKR,
        options: [],
      };
    }

    const options: DiversifiedOption[] = allocationSets.map((opt) => {
      const weights = getWeightsForAvailable(opt, available); // aligned to `available`
      // First pass: per product target PKR and ceil to units
      let slices: ProductSlice[] = available.map((product, idx) => {
        const commissionPerUnit = (product.commission_usd || 0) * usdToPkr;
        const targetPKR = requiredPKR * weights[idx];
        const units = commissionPerUnit > 0 ? Math.ceil(targetPKR / commissionPerUnit) : 0;
        const commissionTotal = units * commissionPerUnit;
        const nots = commissionTotal / NOT_DENOMINATOR;
        return { product, units, commissionPerUnit, commissionTotal, nots };
      });

      // Check shortfall; if under required, add units greedily to product with highest commissionPerUnit
      let sumPKR = slices.reduce((s, sl) => s + sl.commissionTotal, 0);
      if (sumPKR < requiredPKR) {
        // sort indexes by descending commissionPerUnit
        const order = [...slices.keys()].sort((a, b) => slices[b].commissionPerUnit - slices[a].commissionPerUnit);
        let i = 0;
        while (sumPKR < requiredPKR && i < 1000) { // safety cap
          const idx = order[i % order.length];
          slices[idx].units += 1;
          slices[idx].commissionTotal = slices[idx].units * slices[idx].commissionPerUnit;
          slices[idx].nots = slices[idx].commissionTotal / NOT_DENOMINATOR;
          sumPKR = slices.reduce((s, sl) => s + sl.commissionTotal, 0);
          i++;
        }
      }

      const totalCommission = slices.reduce((s, sl) => s + sl.commissionTotal, 0);
      const totalNOTs = totalCommission / NOT_DENOMINATOR;
      const ratioPct = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;
      const fit = fitBadge(ratioPct);
      const deltaNOTs = totalNOTs - dailyTargetNOTs;

      return { label: opt.label, slices, totalCommission, totalNOTs, fit, deltaNOTs };
    });

    return {
      client,
      dailyTargetNOTs,
      requiredCommission: requiredPKR,
      options,
    };
  };

  const clientAnalyses = useMemo(() => {
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered
      .map(buildOptionsForClient)
      .sort((a, b) => (b.client.overall_margin || 0) - (a.client.overall_margin || 0));
  }, [clients, pickCore, usdToPkr, searchTerm, orgDailyTargetNOTs, totalEquity]);

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
          Diversified trade options to hit each client’s daily NOTs target
        </p>
        {apiError && <p className="text-sm text-red-500">Target API error: {apiError}</p>}
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
          <Label htmlFor="usd-rate" className="whitespace-nowrap text-sm">
            USD → PKR
          </Label>
          <div className="relative w-full">
            <Input
              id="usd-rate"
              type="number"
              step="0.01"
              value={usdToPkr}
              onChange={(e) => setUsdToPkr(parseFloat(e.target.value) || 283)}
              className="pr-10 h-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              PKR
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Covered Clients</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientAnalyses.length}</div>
            <p className="text-xs text-muted-foreground">
              Org Daily Target: {formatDecimal(orgDailyTargetNOTs)} NOTs
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Target / Client</CardTitle>
            <Calculator className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatDecimal(
                clientAnalyses.reduce((s, a) => s + a.dailyTargetNOTs, 0) /
                Math.max(clientAnalyses.length, 1)
              )} NOTs
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Daily Target (Shown)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDecimal(clientAnalyses.reduce((s, a) => s + a.dailyTargetNOTs, 0))} NOTs
            </div>
            <p className="text-xs text-muted-foreground">
              Equals org target if all clients are listed
            </p>
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

      {/* Client diversified options */}
      <div className="space-y-6">
        {clientAnalyses.map((analysis) => (
          <Card key={analysis.client.id} className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{analysis.client.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Equity: {formatCurrency(analysis.client.overall_margin)} •{" "}
                    Daily Target: {formatDecimal(analysis.dailyTargetNOTs)} NOTs •{" "}
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
                {analysis.options.map((opt) => (
                  <Card
                    key={opt.label}
                    className={cn(
                      "border-2 transition-colors",
                      opt.fit === "perfect" && "border-trading-profit bg-trading-profit/5",
                      opt.fit === "good" && "border-warning bg-warning/5",
                      opt.fit === "adjust" && "border-muted"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{opt.label}</CardTitle>
                        {opt.fit === "perfect" && <CheckCircle className="h-5 w-5 text-trading-profit" />}
                        {opt.fit === "good" && <AlertCircle className="h-5 w-5 text-warning" />}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        {opt.slices.map((sl) => (
                          <div key={sl.product.id} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {getProductIcon(sl.product.name)} {sl.product.name} — Units
                            </span>
                            <span className="font-semibold">{sl.units}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-border">
                          <span className="text-muted-foreground">Total Commission:</span>
                          <span className="font-medium text-trading-profit">
                            {formatCurrency(opt.totalCommission)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NOTs Generated:</span>
                          <span className="font-bold text-lg">
                            {formatDecimal(opt.totalNOTs)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delta vs Target:</span>
                          <span className={opt.deltaNOTs >= 0 ? "text-trading-profit font-medium" : "text-trading-loss font-medium"}>
                            {opt.deltaNOTs >= 0 ? "+" : ""}
                            {formatDecimal(opt.deltaNOTs)} NOTs
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Badge
                          variant={
                            opt.fit === "perfect"
                              ? "default"
                              : opt.fit === "good"
                              ? "secondary"
                              : "outline"
                          }
                          className="w-full justify-center"
                        >
                          {opt.fit === "perfect" && "🎯 Perfect Match"}
                          {opt.fit === "good" && "✅ Good Option"}
                          {opt.fit === "adjust" && "⚠️ Consider Adjustment"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
              {searchTerm
                ? "Try adjusting your search criteria"
                : "Add clients to see trade recommendations"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
