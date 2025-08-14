import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Calculator, DollarSign, Search, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { Client, Product } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

/**
 * Business rules
 *  - Three suggestions per client (diversified, can be placed separately, per day)
 *  - Must try to meet client's share of org NOTs target (±5% band considered "perfect")
 *  - Must include Gold + Crude + Nasdaq
 *  - Nasdaq: between 1 and 2 units, hard cap at 2
 *  - Gold 100oz only if equity > 5,000,000 PKR
 *  - Keep 20% of equity unused (safety buffer)
 */

const NOT_DENOMINATOR = 6000;

// Initial margin (PKR) per unit
const MARGIN_PER_OZ_GOLD = 25_000; // per oz
const MARGIN_PER_NASDAQ = 219_500; // per contract
const MARGIN_PER_BBL_CRUDE = 850;  // per barrel
const MARGIN_PER_CRUDE_100 = MARGIN_PER_BBL_CRUDE * 100; // 85,000 per 100 bbl

const SPARE_MARGIN_BUFFER = 0.20;   // keep 20% equity free
const GOLD_100OZ_MIN_EQUITY = 5_000_000; // <-- per your new rule

const NASDAQ_MIN = 1; // at least 1
const NASDAQ_MAX = 2; // no more than 2

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
  rationale: string;
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

  // -------- robust product picking (aliases + fallbacks) --------
  const pick = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase();

    const isGold = (n: string) => /(gold|xau)/.test(n);
    const isNasdaq = (n: string) => /(nasdaq|nas100|us100|ndx|\bnq\b)/.test(n);
    const isCrude = (n: string) => /(crude|oil|wti|brent)/.test(n);

    // forgiving 100 bbl patterns
    const is100Bbl = (n: string) =>
      /100\s*(bbl|bbls|barrel|barrels)|100bbls?|bbls?\s*100/.test(n);

    const base = products.filter((p) => {
      const n = norm(p.name);
      if (/\b2nasdaq\b/.test(n)) return false; // explicit 2x products (if any)
      if (/\bid\b/.test(n)) return false;      // skip anything labeled " id " (keeps XAUUSD/US100)
      return isGold(n) || isNasdaq(n) || isCrude(n);
    });

    const gold1 =
      base.find((p) => {
        const n = norm(p.name);
        return isGold(n) && /(1\s*oz|1oz|\b-?1\b|mini|micro)/.test(n);
      }) || null;

    const gold10 =
      base.find((p) => {
        const n = norm(p.name);
        return isGold(n) && /(10\s*oz|10oz|\b-?10\b)/.test(n);
      }) || null;

    const gold100 =
      base.find((p) => {
        const n = norm(p.name);
        return isGold(n) && /(100\s*oz|100oz|\b-?100\b)/.test(n);
      }) || null;

    const nasdaq =
      base.find((p) => isNasdaq(norm(p.name))) || null;

    const crudeAny =
      base.find((p) => isCrude(norm(p.name))) || null;

    // Prefer explicit 100 bbl, fallback to any crude so options don’t vanish
    const crude100 =
      base.find((p) => {
        const n = norm(p.name);
        return isCrude(n) && is100Bbl(n);
      }) || crudeAny || null;

    return { gold1, gold10, gold100, nasdaq, crude100, crudeAny };
  }, [products]);

  // -------- helpers --------
  const instrumentEmoji = (name: string) => {
    const n = (name || "").toLowerCase();
    if (/(gold|xau)/.test(n)) return "🥇";
    if (/(crude|oil|wti|brent)/.test(n)) return "🛢️";
    if (/(nasdaq|nas100|us100|ndx|\bnq\b)/.test(n)) return "📈";
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
    const rtCommissionPerUnit = Math.max(0, (p.commission_usd || 0) * usdToPkr * 2);

    const isGold = /(gold|xau)/.test(n);
    const is1oz = /(1\s*oz|1oz|\b-?1\b|mini|micro)/.test(n);
    const is10oz = /(10\s*oz|10oz|\b-?10\b)/.test(n);
    const is100oz = /(100\s*oz|100oz|\b-?100\b)/.test(n);

    const isNasdaq = /(nasdaq|nas100|us100|ndx|\bnq\b)/.test(n);

    const isCrude = /(crude|oil|wti|brent)/.test(n);
    const is100Bbl = /100\s*(bbl|bbls|barrel|barrels)|100bbls?|bbls?\s*100/.test(n);

    let marginPerUnit = 0;
    if (isGold && is1oz) marginPerUnit = MARGIN_PER_OZ_GOLD * 1;
    else if (isGold && is10oz) marginPerUnit = MARGIN_PER_OZ_GOLD * 10;
    else if (isGold && is100oz) marginPerUnit = MARGIN_PER_OZ_GOLD * 100;
    else if (isNasdaq) marginPerUnit = MARGIN_PER_NASDAQ;
    else if (isCrude && is100Bbl) marginPerUnit = MARGIN_PER_CRUDE_100;
    else if (isCrude) marginPerUnit = MARGIN_PER_CRUDE_100; // fallback (tune if you add other lot sizes)

    return { rtCommissionPerUnit, marginPerUnit };
  };

  // Core allocator: each option MUST include gold + crude + nasdaq, with NASDAQ <= 2 and >= 1
  function buildOption(
    label: string,
    rationale: string,
    goldVariant: Product | null,          // preferred gold instrument for this option
    crude: Product | null,
    nasdaq: Product | null,
    client: Client,
    dailyTargetNOTs: number,
    weights: { gold: number; crude: number; nasdaq: number } // distribution AFTER the 1-unit floor
  ): OptionPlan | null {
    const equity = client.overall_margin || 0;
    if (!crude && pick.crudeAny) crude = pick.crudeAny;
    if (!nasdaq && pick.nasdaq) nasdaq = pick.nasdaq;
    if (!crude || !nasdaq) return null;

    // pick gold variant (fallbacks to keep all three present)
    let gold: Product | null = goldVariant;
    if (!gold) {
      // fallback: try other golds; allow 100oz only if equity > threshold
      gold = pick.gold1 || pick.gold10 || ((equity > GOLD_100OZ_MIN_EQUITY) ? pick.gold100 : null);
    }
    if (!gold) return null; // cannot build option without gold

    // Gold 100oz gating (hard rule)
    const goldName = (gold.name || "").toLowerCase();
    const wants100oz = /(100\s*oz|100oz|\b-?100\b)/.test(goldName);
    if (wants100oz && equity <= GOLD_100OZ_MIN_EQUITY) {
      gold = pick.gold10 || pick.gold1 || null;
      if (!gold) return null;
    }

    const requiredPKR = Math.max(0, dailyTargetNOTs * NOT_DENOMINATOR);
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

    // ---- Step 1: diversification baseline (1 unit each where possible) ----
    let usedCommission = 0;
    let usedMargin = 0;

    // Try to add one unit of each, favoring gold first (your preference)
    for (const s of slices) {
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
        sNasdaq.rtCommissionPerUnit > 0 &&
        sNasdaq.marginPerUnit > 0 &&
        usedMargin + sNasdaq.marginPerUnit <= marginBudget &&
        usedCommission + sNasdaq.rtCommissionPerUnit <= requiredPKR * 1.05
      ) {
        const delta = NASDAQ_MIN - sNasdaq.units;
        sNasdaq.units = NASDAQ_MIN;
        sNasdaq.commissionTotal += delta * sNasdaq.rtCommissionPerUnit;
        sNasdaq.marginTotal += delta * sNasdaq.marginPerUnit;
        usedCommission += delta * sNasdaq.rtCommissionPerUnit;
        usedMargin += delta * sNasdaq.marginPerUnit;
      }
    }
    if (sNasdaq.units > NASDAQ_MAX) {
      const remove = sNasdaq.units - NASDAQ_MAX;
      sNasdaq.units -= remove;
      sNasdaq.commissionTotal -= remove * sNasdaq.rtCommissionPerUnit;
      sNasdaq.marginTotal -= remove * sNasdaq.marginPerUnit;
      usedCommission -= remove * sNasdaq.rtCommissionPerUnit;
      usedMargin -= remove * sNasdaq.marginPerUnit;
    }

    // ---- Step 2: distribute remaining commission by weights (respect NASDAQ_MAX) ----
    const remainingPKR = Math.max(0, requiredPKR - usedCommission);
    const wSum = Math.max(0.0001, (weights.gold + weights.crude + weights.nasdaq));
    const quotas = [
      (weights.gold / wSum) * remainingPKR,   // gold quota
      (weights.crude / wSum) * remainingPKR,  // crude quota
      (weights.nasdaq / wSum) * remainingPKR, // nasdaq quota
    ];

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      if (s.rtCommissionPerUnit <= 0 || s.marginPerUnit <= 0) continue;
      const byQuota = s.rtCommissionPerUnit > 0 ? Math.ceil(quotas[i] / s.rtCommissionPerUnit) : 0;
      const byCommission = s.rtCommissionPerUnit > 0 ? Math.floor((requiredPKR - usedCommission) / s.rtCommissionPerUnit) : 0;
      const byMargin = s.marginPerUnit > 0 ? Math.floor((marginBudget - usedMargin) / s.marginPerUnit) : 0;

      if (i === nasdaqIdx) {
        const maxMore = Math.max(0, NASDAQ_MAX - s.units);
        const add = Math.max(0, Math.min(maxMore, byQuota, byCommission, byMargin));
        if (add > 0) {
          s.units += add;
          s.commissionTotal += add * s.rtCommissionPerUnit;
          s.marginTotal += add * s.marginPerUnit;
          usedCommission += add * s.rtCommissionPerUnit;
          usedMargin += add * s.marginPerUnit;
        }
      } else {
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
    for (const s of slices) {
      s.nots = s.commissionTotal / NOT_DENOMINATOR;
      totalNOTs += s.nots;
    }

    const ratio = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;

    return {
      label,
      rationale,
      slices,
      totalCommission: usedCommission,
      totalMargin: usedMargin,
      totalNOTs,
      deltaNOTs: totalNOTs - dailyTargetNOTs,
      fit: fitBadge(ratio),
    };
  }

  // Build 3 diverse options per client (Gold-lean, Crude-lean, Balanced)
  function buildPlansForClient(client: Client): ClientPlan {
    const share = totalEquity > 0 ? (client.overall_margin || 0) / totalEquity : 0;
    const dailyTargetNOTs = orgDailyTargetNOTs * share;

    // Option A: Gold-lean (prefer 1oz to make per-day smaller tickets, diverse)
    const optA = buildOption(
      "Option A — Gold-lean",
      "Heavier gold slice using 1oz; crude & nasdaq as supporting legs.",
      pick.gold1,
      pick.crude100,
      pick.nasdaq,
      client,
      dailyTargetNOTs,
      { gold: 0.60, crude: 0.25, nasdaq: 0.15 }
    );

    // Option B: Crude-lean (prefer 10oz gold; nasdaq lighter)
    const preferredGoldB =
      pick.gold10 ||
      (client.overall_margin || 0) > GOLD_100OZ_MIN_EQUITY ? pick.gold100 : pick.gold1;

    const optB = buildOption(
      "Option B — Crude-lean",
      "More crude exposure (100 bbl) with 10oz gold; nasdaq capped at ≤2.",
      preferredGoldB,
      pick.crude100,
      pick.nasdaq,
      client,
      dailyTargetNOTs,
      { gold: 0.35, crude: 0.50, nasdaq: 0.15 }
    );

    // Option C: Balanced (allow 100oz if large equity; otherwise 1oz/10oz)
    const preferredGoldC =
      pick.gold1 || pick.gold10 || ((client.overall_margin || 0) > GOLD_100OZ_MIN_EQUITY ? pick.gold100 : null);

    const optC = buildOption(
      "Option C — Balanced",
      "Balanced distribution across gold, crude, and nasdaq, aiming close to target.",
      preferredGoldC,
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

  const anyOptions = plans.some((p) => p.options.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Trade Suggestions</h1>
        <p className="text-muted-foreground">
          Three per-day suggestions per client (Gold, Crude 100 bbl, Nasdaq) — Nasdaq ≤ 2; Gold 100oz only when equity &gt; ₨5,000,000.
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

      {!anyOptions && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4" /> No suggestions generated
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Check that your product names include recognizable aliases (Gold/XAU, Nasdaq/NAS100/US100/NDX/NQ, Crude/Oil/WTI/Brent),
            and that commissions are set. Also ensure the RPC target is returning a positive NOTs target.
          </CardContent>
        </Card>
      )}

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
              {plan.options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No valid combination found within margin/commission constraints for this client.
                </p>
              ) : (
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{opt.rationale}</span>
                            {opt.fit === "perfect" && <CheckCircle className="h-5 w-5 text-trading-profit" />}
                            {opt.fit === "good" && <AlertCircle className="h-5 w-5 text-warning" />}
                          </div>
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
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
