import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
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

// --- Initial margin (PKR) per *unit* ---
const MARGIN_PER_OZ_GOLD = 25_000;          // per oz
const MARGIN_PER_NASDAQ = 219_500;          // per single Nasdaq contract
const MARGIN_PER_BBL_CRUDE = 850;           // per barrel
const MARGIN_PER_CRUDE_100 = MARGIN_PER_BBL_CRUDE * 100; // 85,000 per 100 bbl

// Keep some spare margin (e.g., 20%) unallocated
const SPARE_MARGIN_BUFFER = 0.20;

// Equity threshold for allowing Gold 100oz
const GOLD_100OZ_MIN_EQUITY = 1_000_000;  // PKR

type ProductSlice = {
  product: Product;
  units: number;
  roundTripCommissionPerUnitPKR: number;
  commissionTotalPKR: number;
  nots: number;
  marginPerUnit: number;
  marginTotal: number;
};

type DiversifiedOption = {
  label: string;
  slices: ProductSlice[];
  totalCommissionPKR: number;
  totalNOTs: number;
  fit: "perfect" | "good" | "adjust";
  deltaNOTs: number;
  totalMarginRequired: number;
};

interface ClientDiversifiedAnalysis {
  client: Client;
  dailyTargetNOTs: number;
  requiredCommissionPKR: number;
  options: DiversifiedOption[];
}

export default function TradeSuggestions() {
  const { clients, loading: clientsLoading } = useClients();
  const { products, loading: productsLoading } = useProducts();

  const [usdToPkr, setUsdToPkr] = useState(283);
  const [searchTerm, setSearchTerm] = useState("");

  // Pull same API as useDashboard for consistency
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
        const apiDailyPKR = row?.daily_target_nots ?? 0; // PKR/day from backend
        setTotalEquity(apiTotalEquity);
        setOrgDailyTargetNOTs(apiDailyPKR / NOT_DENOMINATOR); // convert to NOTs
      } catch (e: any) {
        setApiError(e?.message || "Failed to fetch daily target");
        setTotalEquity(0);
        setOrgDailyTargetNOTs(0);
      }
    };
    fetchTargets();
  }, []);

  // --- PRODUCT PICKERS (prefer/avoid) ---
  const productIndex = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase();
    const allowed = products.filter((p) => {
      const n = norm(p.name);
      if (n.includes(" id ")) return false;
      if (n.includes("2nasdaq")) return false;
      if (n.includes("1000") && n.includes("barrel")) return false; // avoid 1000 barrels
      return (
        n.includes("gold") ||
        n.includes("nasdaq") ||
        n.includes("crude")
      );
    });

    // Prefer exact variants
    const gold1 = allowed.find(p => {
      const n = norm(p.name);
      return n.includes("gold") && (n.includes("1oz") || n.includes("1 oz") || n.endsWith(" 1oz"));
    }) || null;

    const gold10 = allowed.find(p => {
      const n = norm(p.name);
      return n.includes("gold") && (n.includes("10oz") || n.includes("10 oz"));
    }) || null;

    const gold100 = allowed.find(p => {
      const n = norm(p.name);
      return n.includes("gold") && (n.includes("100oz") || n.includes("100 oz"));
    }) || null;

    const nasdaq = allowed.find(p => {
      const n = norm(p.name);
      // plain "nasdaq" (avoid 2nasdaq already filtered)
      return n.includes("nasdaq");
    }) || null;

    const crude100 = allowed.find(p => {
      const n = norm(p.name);
      // prefer "100 barrels" / "100 bbl"
      return n.includes("crude") && (n.includes("100 barrel") || n.includes("100 bbl") || n.includes("100brl") || n.includes("100brl"));
    }) || null;

    return { gold1, gold10, gold100, nasdaq, crude100 };
  }, [products]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

  const formatDecimal = (value: number, decimals: number = 2) =>
    Number(value ?? 0).toFixed(decimals);

  const fitBadge = (ratioPct: number): "perfect" | "good" | "adjust" => {
    if (ratioPct >= 95 && ratioPct <= 105) return "perfect";
    if (ratioPct >= 85 && ratioPct <= 120) return "good";
    return "adjust";
  };

  // Commission (PKR) per unit (ROUND TRIP) + margin per unit (PKR) by product
  const metricsForProduct = (p: Product) => {
    const name = (p.name || "").toLowerCase();
    const roundTripCommissionPerUnitPKR = (p.commission_usd || 0) * usdToPkr * 2;
    let marginPerUnit = 0;

    if (name.includes("gold") && (name.includes("1oz") || name.includes("1 oz"))) {
      marginPerUnit = MARGIN_PER_OZ_GOLD * 1;
    } else if (name.includes("gold") && (name.includes("10oz") || name.includes("10 oz"))) {
      marginPerUnit = MARGIN_PER_OZ_GOLD * 10;
    } else if (name.includes("gold") && (name.includes("100oz") || name.includes("100 oz"))) {
      marginPerUnit = MARGIN_PER_OZ_GOLD * 100;
    } else if (name.includes("nasdaq")) {
      marginPerUnit = MARGIN_PER_NASDAQ;
    } else if (name.includes("crude") && (name.includes("100 barrel") || name.includes("100 bbl") || name.includes("100brl"))) {
      marginPerUnit = MARGIN_PER_CRUDE_100;
    } else if (name.includes("crude")) {
      // fallback: if some other crude unit, try to parse barrels; otherwise assume 100
      marginPerUnit = MARGIN_PER_CRUDE_100;
    }

    return { roundTripCommissionPerUnitPKR, marginPerUnit };
  };

  // Rotation-based balanced filler to avoid lopsided counts.
  // We rotate through a prioritized list of instruments and add 1 unit at a time,
  // as long as commission and margin constraints make sense.
  const buildOptionByRotation = (
    label: string,
    instruments: Product[],
    client: Client,
    dailyTargetNOTs: number
  ): DiversifiedOption => {
    const slices: ProductSlice[] = instruments.map((p) => {
      const { roundTripCommissionPerUnitPKR, marginPerUnit } = metricsForProduct(p);
      return {
        product: p,
        units: 0,
        roundTripCommissionPerUnitPKR,
        commissionTotalPKR: 0,
        nots: 0,
        marginPerUnit,
        marginTotal: 0,
      };
    });

    const requiredCommissionPKR = dailyTargetNOTs * NOT_DENOMINATOR;

    // Margin budget: equity minus spare buffer
    const availableMarginBudget = Math.max(0, (client.overall_margin || 0) * (1 - SPARE_MARGIN_BUFFER));

    // Greedy rotation loop
    let totalCommission = 0;
    let totalMargin = 0;
    let safety = 0;

    // If no commission info (all zero), bail early
    if (slices.every(s => s.roundTripCommissionPerUnitPKR <= 0)) {
      return {
        label,
        slices,
        totalCommissionPKR: 0,
        totalNOTs: 0,
        fit: "adjust",
        deltaNOTs: -dailyTargetNOTs,
        totalMarginRequired: 0,
      };
    }

    while (totalCommission < requiredCommissionPKR && safety < 5000) {
      for (let i = 0; i < slices.length && totalCommission < requiredCommissionPKR; i++) {
        const s = slices[i];
        // Equity guards:
        // - Disallow gold 100oz if equity <= threshold
        const nm = (s.product.name || "").toLowerCase();
        if (nm.includes("gold") && (nm.includes("100oz") || nm.includes("100 oz")) && (client.overall_margin || 0) <= GOLD_100OZ_MIN_EQUITY) {
          continue; // skip this instrument
        }

        const nextUnits = s.units + 1;
        const nextCommissionTotal = s.roundTripCommissionPerUnitPKR * nextUnits;
        const nextMarginTotal = s.marginPerUnit * nextUnits;

        const newTotalCommission = totalCommission - s.commissionTotalPKR + nextCommissionTotal;
        const newTotalMargin = totalMargin - s.marginTotal + nextMarginTotal;

        // Margin constraint
        if (newTotalMargin > availableMarginBudget) {
          continue; // skip adding this unit; margin would exceed
        }

        // Accept this unit
        s.units = nextUnits;
        s.commissionTotalPKR = nextCommissionTotal;
        s.marginTotal = nextMarginTotal;

        totalCommission = newTotalCommission;
        totalMargin = newTotalMargin;

        // Small early break to re-check while condition
        if (totalCommission >= requiredCommissionPKR) break;
      }
      safety++;
      if (safety > 4999) break; // hard cap
      // If a full pass adds nothing (stuck due to margin), break
      if (slices.every(sl => sl.units === 0) && safety > 2) break;
    }

    // Compute totals / NOTs and apply fit logic
    let totalNOTs = 0;
    for (const s of slices) {
      s.nots = s.commissionTotalPKR / NOT_DENOMINATOR;
      totalNOTs += s.nots;
    }

    const ratioPct = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;
    const fit = fitBadge(ratioPct);
    const deltaNOTs = totalNOTs - dailyTargetNOTs;

    return {
      label,
      slices,
      totalCommissionPKR: totalCommission,
      totalNOTs,
      fit,
      deltaNOTs,
      totalMarginRequired: totalMargin,
    };
  };

  const buildOptionsForClient = (client: Client): ClientDiversifiedAnalysis => {
    const share = totalEquity > 0 ? (client.overall_margin || 0) / totalEquity : 0;
    const dailyTargetNOTs = orgDailyTargetNOTs * share;

    const { gold1, gold10, gold100, nasdaq, crude100 } = productIndex;

    // Build prioritized arrays for rotation according to your rules:

    // Option A: Gold-first (all Gold 1oz core), then rotate with Crude 100bbl, then Nasdaq
    const optA: Product[] = [
      ...(gold1 ? [gold1] : []),
      ...(crude100 ? [crude100] : []),
      ...(nasdaq ? [nasdaq] : []),
    ];

    // Option B: Gold 10oz core, then Crude 100bbl, then Nasdaq
    const optB: Product[] = [
      ...(gold10 ? [gold10] : []),
      ...(crude100 ? [crude100] : []),
      ...(nasdaq ? [nasdaq] : []),
    ];

    // Option C: Mixed rotation. If equity > 1M and gold100 exists, include it sparingly at end.
    const includeGold100 = gold100 && (client.overall_margin || 0) > GOLD_100OZ_MIN_EQUITY;
    const optC: Product[] = [
      ...(gold1 ? [gold1] : []),
      ...(crude100 ? [crude100] : []),
      ...(nasdaq ? [nasdaq] : []),
      ...(includeGold100 ? [gold100!] : []),
    ];

    const options: DiversifiedOption[] = [];
    if (optA.length) options.push(buildOptionByRotation("Option A (Gold 1oz focus)", optA, client, dailyTargetNOTs));
    if (optB.length) options.push(buildOptionByRotation("Option B (Gold 10oz focus)", optB, client, dailyTargetNOTs));
    if (optC.length) options.push(buildOptionByRotation("Option C (Mixed)", optC, client, dailyTargetNOTs));

    // Compute required PKR for reference
    const requiredCommissionPKR = dailyTargetNOTs * NOT_DENOMINATOR;

    // Finalize slice NOTs (redundant but explicit) and ensure no weird 13/1/1 due to sorting:
    // rotation inherently balances adds across the list in order.
    return {
      client,
      dailyTargetNOTs,
      requiredCommissionPKR,
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
  }, [clients, orgDailyTargetNOTs, totalEquity, productIndex, usdToPkr, searchTerm]);

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
          Diversified, margin-aware suggestions to hit each client’s daily NOTs target
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
            <DollarSign className="h-4 w-4 text-muted-foreground" />
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
                    Required Commission: {formatCurrency(analysis.requiredCommissionPKR)}
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
                              {instrumentEmoji(sl.product.name)} {sl.product.name} — Units
                            </span>
                            <span className="font-semibold">{sl.units}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-border">
                          <span className="text-muted-foreground">Total Commission (RT):</span>
                          <span className="font-medium text-trading-profit">
                            {formatCurrency(opt.totalCommissionPKR)}
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
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin Required:</span>
                          <span className="font-medium">
                            {formatCurrency(opt.totalMarginRequired)}
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

// --- UI helpers ---
function instrumentEmoji(name: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("gold")) return "🥇";
  if (n.includes("crude")) return "🛢️";
  if (n.includes("nasdaq")) return "📈";
  return "📊";
}
