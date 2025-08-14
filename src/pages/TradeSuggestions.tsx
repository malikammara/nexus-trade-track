import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Calculator, DollarSign, Search, AlertCircle, CheckCircle } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { Client, Product } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const NOT_DENOMINATOR = 6000;

// Initial margin (PKR) per *unit*
const MARGIN_PER_OZ_GOLD = 25_000;            // per oz
const MARGIN_PER_NASDAQ = 219_500;            // per contract
const MARGIN_PER_BBL_CRUDE = 850;             // per barrel
const MARGIN_PER_CRUDE_100 = MARGIN_PER_BBL_CRUDE * 100; // 85,000 per 100 bbl

const SPARE_MARGIN_BUFFER = 0.20;             // keep 20% equity free
const GOLD_100OZ_MIN_EQUITY = 1_000_000;      // allow 100oz only above this

const NASDAQ_MIN = 1;                         // at least 1
const NASDAQ_MAX = 2;                         // no more than 2

type Slice = {
  product: Product;
  units: number;
  rtCommissionPerUnit: number;   // PKR (round-trip)
  commissionTotal: number;       // PKR
  nots: number;
  marginPerUnit: number;         // PKR
  marginTotal: number;           // PKR
};

type OptionPlan = {
  label: string;
  slices: Slice[];
  totalCommission: number;       // PKR
  totalNOTs: number;
  totalMargin: number;           // PKR
  deltaNOTs: number;
  fit: "perfect" | "good" | "adjust";
};

interface ClientPlan {
  client: Client;
  dailyTargetNOTs: number;
  requiredCommission: number;    // PKR
  options: OptionPlan[];
}

export default function TradeSuggestions() {
  const { clients, loading: clientsLoading } = useClients();
  const { products, loading: productsLoading } = useProducts();

  const [usdToPkr, setUsdToPkr] = useState(283);
  const [searchTerm, setSearchTerm] = useState("");

  // RPC target (same as Dashboard)
  const [orgDailyTargetNOTs, setOrgDailyTargetNOTs] = useState(0);
  const [totalEquity, setTotalEquity] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setApiError(null);
        const { data, error } = await supabase.rpc("calculate_equity_based_target");
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        setTotalEquity(row?.total_equity ?? 0);
        setOrgDailyTargetNOTs((row?.daily_target_nots ?? 0) / NOT_DENOMINATOR);
      } catch (e: any) {
        setApiError(e?.message || "Failed to fetch equity-based target");
        setTotalEquity(0);
        setOrgDailyTargetNOTs(0);
      }
    };
    run();
  }, []);

  // -------- robust product picking (and exclusions) --------
  const pick = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase();

    const base = products.filter((p) => {
      const n = norm(p.name);
      if (n.includes(" id ")) return false;
      if (n.includes("2nasdaq")) return false;
      if (n.includes("1000") && n.includes("barrel")) return false; // exclude 1000 barrels
      return n.includes("gold") || n.includes("xau") || n.includes("nasdaq") || n.includes("crude");
    });

    const isGold = (n: string) => n.includes("gold") || n.includes("xau");
    const has = (n: string, t: string) => n.includes(t);

    const gold1 =
      base.find((p) => {
        const n = norm(p.name);
        return isGold(n) && (has(n, "1oz") || has(n, "1 oz") || has(n, "-1") || has(n, " mini"));
      }) || null;

    const gold10 =
      base.find((p) => {
        const n = norm(p.name);
        return isGold(n) && (has(n, "10oz") || has(n, "10 oz") || has(n, "-10"));
      }) || null;

    const gold100 =
      base.find((p) => {
        const n = norm(p.name);
        return isGold(n) && (has(n, "100oz") || has(n, "100 oz") || has(n, "-100"));
      }) || null;

    const nasdaq =
      base.find((p) => norm(p.name).includes("nasdaq")) || null;

    const crude100 =
      base.find((p) => {
        const n = norm(p.name);
        return n.includes("crude") && (n.includes("100 barrel") || n.includes("100 bbl") || n.includes("100brl") || n.includes("100 brl"));
      }) || null;

    return { gold1, gold10, gold100, nasdaq, crude100 };
  }, [products]);

  // -------- helpers --------
  const instrumentEmoji = (name: string) => {
    const n = (name || "").toLowerCase();
    if (n.includes("gold") || n.includes("xau")) return "🥇";
    if (n.includes("crude")) return "🛢️";
    if (n.includes("nasdaq")) return "📈";
    return "📊";
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 })
      .format(amount ?? 0);

  const formatDecimal = (value: number, decimals = 2) => Number(value ?? 0).toFixed(decimals);

  const fitBadge = (ratioPct: number): "perfect" | "good" | "adjust" => {
    if (ratioPct >= 95 && ratioPct <= 105) return "perfect";
    if (ratioPct >= 85 && ratioPct <= 120) return "good";
    return "adjust";
  };

  const perUnitMetrics = (p: Product) => {
    const n = (p.name || "").toLowerCase();
    const rtCommissionPerUnit = (p.commission_usd || 0) * usdToPkr * 2;

    let marginPerUnit = 0;
    if ((n.includes("gold") || n.includes("xau")) && (n.includes("1oz") || n.includes("1 oz") || n.includes("-1") || n.includes(" mini")))
      marginPerUnit = MARGIN_PER_OZ_GOLD * 1;
    else if ((n.includes("gold") || n.includes("xau")) && (n.includes("10oz") || n.includes("10 oz") || n.includes("-10")))
      marginPerUnit = MARGIN_PER_OZ_GOLD * 10;
    else if ((n.includes("gold") || n.includes("xau")) && (n.includes("100oz") || n.includes("100 oz") || n.includes("-100")))
      marginPerUnit = MARGIN_PER_OZ_GOLD * 100;
    else if (n.includes("nasdaq"))
      marginPerUnit = MARGIN_PER_NASDAQ;
    else if (n.includes("crude") && (n.includes("100 barrel") || n.includes("100 bbl") || n.includes("100brl") || n.includes("100 brl")))
      marginPerUnit = MARGIN_PER_CRUDE_100;
    else if (n.includes("crude"))
      marginPerUnit = MARGIN_PER_CRUDE_100;

    return { rtCommissionPerUnit, marginPerUnit };
  };

  // Core allocator: every option MUST include gold + crude + nasdaq, with NASDAQ <= 2 and >= 1
  function buildOption(
    label: string,
    goldVariant: Product | null,          // preferred gold instrument for this option
    crude: Product | null,
    nasdaq: Product | null,
    client: Client,
    dailyTargetNOTs: number,
    weights: { gold: number; crude: number; nasdaq: number } // distribution AFTER the 1-unit floor
  ): OptionPlan | null {
    const equity = client.overall_margin || 0;
    if (!crude || !nasdaq) return null;

    // pick gold variant (fallbacks to keep all three present)
    let gold: Product | null = goldVariant;
    if (!gold) {
      // fallback: try other golds
      gold = pick.gold1 || pick.gold10 || ((equity > GOLD_100OZ_MIN_EQUITY) ? pick.gold100 : null);
    }
    if (!gold) return null; // cannot build option without gold

    // Gold 100oz gating
    const goldName = (gold.name || "").toLowerCase();
    if ((goldName.includes("100oz") || goldName.includes("100 oz") || goldName.includes("-100")) &&
        equity <= GOLD_100OZ_MIN_EQUITY) {
      // downgrade to 10oz or 1oz if possible
      gold = pick.gold10 || pick.gold1 || null;
      if (!gold) return null;
    }

    const requiredPKR = dailyTargetNOTs * NOT_DENOMINATOR;
    const marginBudget = Math.max(0, equity * (1 - SPARE_MARGIN_BUFFER));

    // Initialize slices for the three instruments
    const baseProducts: Product[] = [gold, crude, nasdaq];
    const slices: Slice[] = baseProducts.map((p) => {
      const { rtCommissionPerUnit, marginPerUnit } = perUnitMetrics(p);
      return {
        product: p,
        units: 0,
        rtCommissionPerUnit,
        commissionTotal: 0,
        nots: 0,
        marginPerUnit,
        marginTotal: 0,
      };
    });

    // ---- Step 1: guarantee diversification (1 unit each if possible) ----
    let usedCommission = 0;
    let usedMargin = 0;

    // Always try Gold first (your preference)
    for (const idx of [0, 1, 2]) {
      const s = slices[idx];
      // enforce nasdaq caps later; here we still try to add 1 baseline unit
      const gateGold100 =
        ((s.product.name || "").toLowerCase().includes("100")) &&
        (goldName.includes("100")) &&
        equity <= GOLD_100OZ_MIN_EQUITY;

      if (gateGold100) continue;

      if (
        s.rtCommissionPerUnit > 0 &&
        s.marginPerUnit > 0 &&
        usedMargin + s.marginPerUnit <= marginBudget &&
        usedCommission + s.rtCommissionPerUnit <= requiredPKR * 1.05
      ) {
        s.units = 1;
        s.commissionTotal = s.rtCommissionPerUnit;
        s.marginTotal = s.marginPerUnit;
        usedCommission += s.rtCommissionPerUnit;
        usedMargin += s.marginPerUnit;
      }
    }

    // Enforce NASDAQ baseline & cap
    const nasdaqIdx = 2;
    const sNasdaq = slices[nasdaqIdx];
    if (sNasdaq.units < NASDAQ_MIN) {
      if (
        usedMargin + sNasdaq.marginPerUnit <= marginBudget &&
        usedCommission + sNasdaq.rtCommissionPerUnit <= requiredPKR * 1.05
      ) {
        sNasdaq.units = NASDAQ_MIN;
        sNasdaq.commissionTotal = sNasdaq.units * sNasdaq.rtCommissionPerUnit;
        sNasdaq.marginTotal = sNasdaq.units * sNasdaq.marginPerUnit;
        usedCommission += sNasdaq.rtCommissionPerUnit * (NASDAQ_MIN - (sNasdaq.units - NASDAQ_MIN));
        usedMargin += sNasdaq.marginPerUnit * (NASDAQ_MIN - (sNasdaq.units - NASDAQ_MIN));
      }
    }

    // ---- Step 2: distribute remaining commission by weights (respect NASDAQ_MAX) ----
    const remainingPKR = Math.max(0, requiredPKR - usedCommission);
    const wSum = weights.gold + weights.crude + weights.nasdaq || 1;
    const quotas = [
      (weights.gold / wSum) * remainingPKR,
      (weights.crude / wSum) * remainingPKR,
      (weights.nasdaq / wSum) * remainingPKR,
    ];

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      if (i === nasdaqIdx) {
        // cap nasdaq
        const maxMore = NASDAQ_MAX - s.units;
        if (maxMore <= 0) continue;

        // how many units fit quota/margin/commission?
        const byQuota = Math.ceil(quotas[i] / s.rtCommissionPerUnit);
        const byCommission = Math.floor((requiredPKR - usedCommission) / s.rtCommissionPerUnit);
        const byMargin = Math.floor((marginBudget - usedMargin) / s.marginPerUnit);
        const add = Math.max(0, Math.min(maxMore, byQuota, byCommission, byMargin));

        if (add > 0) {
          s.units += add;
          s.commissionTotal += add * s.rtCommissionPerUnit;
          s.marginTotal += add * s.marginPerUnit;
          usedCommission += add * s.rtCommissionPerUnit;
          usedMargin += add * s.marginPerUnit;
        }
      } else {
        // gold/crude
        if (s.rtCommissionPerUnit <= 0 || s.marginPerUnit <= 0) continue;
        const byQuota = Math.ceil(quotas[i] / s.rtCommissionPerUnit);
        const byCommission = Math.floor((requiredPKR - usedCommission) / s.rtCommissionPerUnit);
        const byMargin = Math.floor((marginBudget - usedMargin) / s.marginPerUnit);
        const add = Math.max(0, Math.min(byQuota, byCommission, byMargin));
        if (add > 0) {
          s.units += add;
          s.commissionTotal += add * s.rtCommissionPerUnit;
          s.marginTotal += add * s.marginPerUnit;
          usedCommission += add * s.rtCommissionPerUnit;
          usedMargin += add * s.marginPerUnit;
        }
      }
    }

    // ---- Step 3: if still short, top-up in focus order (Gold → Crude → Nasdaq<=2) ----
    const focusOrder = [0, 1, 2]; // gold, crude, nasdaq
    let safety = 0;
    while (usedCommission < requiredPKR && safety < 1000) {
      let added = false;
      for (const i of focusOrder) {
        const s = slices[i];
        if (s.rtCommissionPerUnit <= 0 || s.marginPerUnit <= 0) continue;
        if (i === nasdaqIdx && s.units >= NASDAQ_MAX) continue; // respect cap
        if (
          usedMargin + s.marginPerUnit <= marginBudget &&
          usedCommission + s.rtCommissionPerUnit <= requiredPKR * 1.05
        ) {
          s.units += 1;
          s.commissionTotal += s.rtCommissionPerUnit;
          s.marginTotal += s.marginPerUnit;
          usedCommission += s.rtCommissionPerUnit;
          usedMargin += s.marginPerUnit;
          added = true;
          if (usedCommission >= requiredPKR) break;
        }
      }
      if (!added) break; // stuck on margins
      safety++;
    }

    // compute NOTs + fit
    let totalNOTs = 0;
    for (const s of slices) s.nots = s.commissionTotal / NOT_DENOMINATOR, totalNOTs += s.nots;

    const ratio = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;

    return {
      label,
      slices,
      totalCommission: usedCommission,
      totalMargin: usedMargin,
      totalNOTs,
      deltaNOTs: totalNOTs - dailyTargetNOTs,
      fit: fitBadge(ratio),
    };
  }

  function buildPlansForClient(client: Client): ClientPlan {
    const share = totalEquity > 0 ? (client.overall_margin || 0) / totalEquity : 0;
    const dailyTargetNOTs = orgDailyTargetNOTs * share;

    // Option A: Gold 1oz focus (after 1-unit floor: heavy gold)
    const optA = buildOption(
      "Option A (Gold 1oz focus)",
      pick.gold1,                      // preferred gold
      pick.crude100,
      pick.nasdaq,
      client,
      dailyTargetNOTs,
      { gold: 0.65, crude: 0.25, nasdaq: 0.10 }
    );

    // Option B: Gold 10oz focus (after floor: heavy gold10)
    const optB = buildOption(
      "Option B (Gold 10oz focus)",
      pick.gold10,                     // preferred gold
      pick.crude100,
      pick.nasdaq,
      client,
      dailyTargetNOTs,
      { gold: 0.55, crude: 0.30, nasdaq: 0.15 }
    );

    // Option C: Balanced mix (after floor)
    const optC = buildOption(
      "Option C (Balanced)",
      pick.gold1 || pick.gold10 || ((client.overall_margin || 0) > GOLD_100OZ_MIN_EQUITY ? pick.gold100 : null),
      pick.crude100,
      pick.nasdaq,
      client,
      dailyTargetNOTs,
      { gold: 0.40, crude: 0.40, nasdaq: 0.20 }
    );

    const options = [optA, optB, optC].filter(Boolean) as OptionPlan[];

    return {
      client,
      dailyTargetNOTs,
      requiredCommission: dailyTargetNOTs * NOT_DENOMINATOR,
      options,
    };
  }

  const plans = useMemo(() => {
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered
      .map(buildPlansForClient)
      .sort((a, b) => (b.client.overall_margin || 0) - (a.client.overall_margin || 0));
  }, [clients, pick, orgDailyTargetNOTs, totalEquity, usdToPkr, searchTerm]);

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
          Each option includes Gold, Crude (100 bbl), and Nasdaq — with ≤2 Nasdaq contracts.
        </p>
        {apiError && <p className="text-sm text-red-500">Target API error: {apiError}</p>}
      </div>

      {/* Controls */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="usd-rate" className="whitespace-nowrap text-sm">USD → PKR</Label>
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
            <div className="text-2xl font-bold">{plans.length}</div>
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
                plans.reduce((s, a) => s + a.dailyTargetNOTs, 0) / Math.max(plans.length, 1)
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
              {formatDecimal(plans.reduce((s, a) => s + a.dailyTargetNOTs, 0))} NOTs
            </div>
            <p className="text-xs text-muted-foreground">Equals org target if all clients listed</p>
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

      {/* Client options */}
      <div className="space-y-6">
        {plans.map((plan) => (
          <Card key={plan.client.id} className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{plan.client.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Equity: {formatCurrency(plan.client.overall_margin)} • Daily Target:{" "}
                    {formatDecimal(plan.dailyTargetNOTs)} NOTs • Required Commission:{" "}
                    {formatCurrency(plan.requiredCommission)}
                  </p>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {formatDecimal(plan.dailyTargetNOTs)} NOTs/day
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {plan.options.map((opt) => (
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
                        {opt.slices.map((s) => (
                          <div key={s.product.id} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {instrumentEmoji(s.product.name)} {s.product.name} — Units
                            </span>
                            <span className="font-semibold">{s.units}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-border">
                          <span className="text-muted-foreground">Total Commission (RT):</span>
                          <span className="font-medium text-trading-profit">
                            {formatCurrency(opt.totalCommission)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NOTs Generated:</span>
                          <span className="font-bold text-lg">{formatDecimal(opt.totalNOTs)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delta vs Target:</span>
                          <span className={opt.deltaNOTs >= 0 ? "text-trading-profit font-medium" : "text-trading-loss font-medium"}>
                            {opt.deltaNOTs >= 0 ? "+" : ""}{formatDecimal(opt.deltaNOTs)} NOTs
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin Required:</span>
                          <span className="font-medium">{formatCurrency(opt.totalMargin)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
