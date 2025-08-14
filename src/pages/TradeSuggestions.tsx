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
  CheckCircle,
} from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { Client, Product } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const NOT_DENOMINATOR = 6000;

// Initial margin (PKR) per *unit*
const MARGIN_PER_OZ_GOLD = 25_000;           // per oz
const MARGIN_PER_NASDAQ = 219_500;           // per NASDAQ contract
const MARGIN_PER_BBL_CRUDE = 850;            // per barrel
const MARGIN_PER_CRUDE_100 = MARGIN_PER_BBL_CRUDE * 100; // 85,000 per 100 bbl

// Keep some spare margin unallocated
const SPARE_MARGIN_BUFFER = 0.20;

// Equity threshold for Gold 100oz
const GOLD_100OZ_MIN_EQUITY = 5_000_000;     // PKR

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

  // Same API as Dashboard for consistency
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

  // ---------- Product resolution (robust + explicit avoids) ----------
  const pick = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase();

    // Allowed base set
    const base = products.filter((p) => {
      const n = norm(p.name);
      if (n.includes(" id ")) return false;
      if (n.includes("2nasdaq")) return false;
      if (n.includes("1000") && n.includes("barrel")) return false; // avoid 1000 barrels
      return n.includes("gold") || n.includes("nasdaq") || n.includes("xau") || n.includes("crude");
    });

    // Helpers
    const isGold = (n: string) => n.includes("gold") || n.includes("xau");
    const has = (n: string, str: string) => n.includes(str);

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
      base.find((p) => {
        const n = norm(p.name);
        // keep plain nasdaq (2nasdaq already filtered)
        return n.includes("nasdaq");
      }) || null;

    const crude100 =
      base.find((p) => {
        const n = norm(p.name);
        return n.includes("crude") && (n.includes("100 barrel") || n.includes("100 bbl") || n.includes("100brl") || n.includes("100 brl"));
      }) || null;

    return { gold1, gold10, gold100, nasdaq, crude100 };
  }, [products]);

  // ---------- utils ----------
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

  const formatDecimal = (value: number, decimals = 2) =>
    Number(value ?? 0).toFixed(decimals);

  const instrumentEmoji = (name: string) => {
    const n = (name || "").toLowerCase();
    if (n.includes("gold") || n.includes("xau")) return "🥇";
    if (n.includes("crude")) return "🛢️";
    if (n.includes("nasdaq")) return "📈";
    return "📊";
  };

  const fitBadge = (ratioPct: number): "perfect" | "good" | "adjust" => {
    if (ratioPct >= 95 && ratioPct <= 105) return "perfect";
    if (ratioPct >= 85 && ratioPct <= 120) return "good";
    return "adjust";
  };

  // Commission/margin per unit for a product (round trip commission!)
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
      marginPerUnit = MARGIN_PER_CRUDE_100; // fallback

    return { rtCommissionPerUnit, marginPerUnit };
  };

  // Compute units for a given quota, bounded by commission and margin budgets
  function computeUnitsForQuota(
    p: Product,
    quotaPKR: number,
    remainingCommissionPKR: number,
    remainingMarginPKR: number,
    equity: number
  ) {
    const n = (p.name || "").toLowerCase();
    // Gold 100oz gating
    if ((n.includes("gold") || n.includes("xau")) &&
        (n.includes("100oz") || n.includes("100 oz") || n.includes("-100")) &&
        equity <= GOLD_100OZ_MIN_EQUITY) {
      return 0;
    }

    const { rtCommissionPerUnit, marginPerUnit } = perUnitMetrics(p);
    if (rtCommissionPerUnit <= 0 || marginPerUnit <= 0) return 0;

    // target by quota
    const byQuota = Math.ceil(quotaPKR / rtCommissionPerUnit);
    // hard caps by budgets
    const byCommission = Math.floor(remainingCommissionPKR / rtCommissionPerUnit);
    const byMargin = Math.floor(remainingMarginPKR / marginPerUnit);

    const units = Math.max(0, Math.min(byQuota, byCommission, byMargin));
    return units;
  }

  function buildSlices(
    prods: Product[],
    quotas: number[],                // PKR quota for each product
    requiredPKR: number,            // total commission needed (PKR)
    equity: number
  ): { slices: Slice[]; totalCommission: number; totalMargin: number } {
    const slices: Slice[] = prods.map((p) => {
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

    const marginBudget = Math.max(0, equity * (1 - SPARE_MARGIN_BUFFER));

    // First pass: allocate by quotas
    let usedCommission = 0;
    let usedMargin = 0;

    for (let i = 0; i < prods.length; i++) {
      const p = prods[i];
      const quota = quotas[i];
      const units = computeUnitsForQuota(
        p,
        quota,
        requiredPKR - usedCommission,
        marginBudget - usedMargin,
        equity
      );
      if (units > 0) {
        slices[i].units = units;
        slices[i].commissionTotal = units * slices[i].rtCommissionPerUnit;
        slices[i].marginTotal = units * slices[i].marginPerUnit;
        usedCommission += slices[i].commissionTotal;
        usedMargin += slices[i].marginTotal;
      }
    }

    // Second pass: if still short, top up by cheapest-commission product first,
    // but respect margin and Gold100 gating.
    let safety = 0;
    while (usedCommission < requiredPKR && safety < 2000) {
      // Choose product with lowest rtCommissionPerUnit (cost-effective)
      const idx = slices
        .map((s, i) => ({ i, c: s.rtCommissionPerUnit }))
        .sort((a, b) => a.c - b.c)
        .find(({ i }) => {
          const s = slices[i];
          const name = (s.product.name || "").toLowerCase();
          if ((name.includes("gold") || name.includes("xau")) &&
              (name.includes("100oz") || name.includes("100 oz") || name.includes("-100")) &&
              equity <= GOLD_100OZ_MIN_EQUITY) {
            return false;
          }
          return usedMargin + s.marginPerUnit <= marginBudget &&
                 usedCommission + s.rtCommissionPerUnit <= requiredPKR * 1.05; // allow tiny overshoot
        });

      if (!idx) break;

      const s = slices[idx.i];
      s.units += 1;
      s.commissionTotal += s.rtCommissionPerUnit;
      s.marginTotal += s.marginPerUnit;
      usedCommission += s.rtCommissionPerUnit;
      usedMargin += s.marginPerUnit;
      safety++;
    }

    return { slices, totalCommission: usedCommission, totalMargin: usedMargin };
  }

  function buildOptionsForClient(client: Client): ClientPlan {
    const share = totalEquity > 0 ? (client.overall_margin || 0) / totalEquity : 0;
    const dailyTargetNOTs = orgDailyTargetNOTs * share;
    const requiredPKR = dailyTargetNOTs * NOT_DENOMINATOR;

    const { gold1, gold10, gold100, nasdaq, crude100 } = pick;

    const options: OptionPlan[] = [];

    // ---------------- Option A: Gold 1oz core, remainder split 50/50 Crude/Nasdaq
    if (gold1) {
      const instruments: Product[] = [gold1, ...(crude100 ? [crude100] : []), ...(nasdaq ? [nasdaq] : [])];
      const weights: number[] = instruments.map((p, i) => (i === 0 ? 1 : 0)); // all to gold1 initially
      // First pass: try to fill entirely with gold1
      let quotas = weights.map((w) => requiredPKR * w);
      let { slices, totalCommission, totalMargin } = buildSlices(instruments, quotas, requiredPKR, client.overall_margin || 0);

      if (totalCommission < requiredPKR * 0.995 && (crude100 || nasdaq)) {
        // Split remainder 50/50 into crude/nasdaq
        const remainder = requiredPKR - totalCommission;
        const secondProds: Product[] = [];
        if (crude100) secondProds.push(crude100);
        if (nasdaq) secondProds.push(nasdaq);

        const remainderQuotas = secondProds.map(() => remainder / Math.max(secondProds.length, 1));
        const add = buildSlices(secondProds, remainderQuotas, remainder, (client.overall_margin || 0) - totalMargin);

        // Merge add into slices
        for (const addSlice of add.slices) {
          const idx = slices.findIndex((s) => s.product.id === addSlice.product.id);
          if (idx >= 0) {
            slices[idx].units += addSlice.units;
            slices[idx].commissionTotal += addSlice.commissionTotal;
            slices[idx].marginTotal += addSlice.marginTotal;
          } else {
            slices.push(addSlice);
          }
        }
        totalCommission += add.totalCommission;
        totalMargin += add.totalMargin;
      }

      let totalNOTs = 0;
      for (const s of slices) s.nots = s.commissionTotal / NOT_DENOMINATOR, totalNOTs += s.nots;

      const ratio = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;
      options.push({
        label: "Option A (Gold 1oz focus)",
        slices,
        totalCommission,
        totalMargin,
        totalNOTs,
        deltaNOTs: totalNOTs - dailyTargetNOTs,
        fit: fitBadge(ratio),
      });
    }

    // ---------------- Option B: Gold 10oz core, remainder split 50/50 Crude/Nasdaq
    if (gold10) {
      const instruments: Product[] = [gold10, ...(crude100 ? [crude100] : []), ...(nasdaq ? [nasdaq] : [])];
      const quotas = instruments.map((p, i) => (i === 0 ? requiredPKR : 0)); // all to gold10 initially
      let { slices, totalCommission, totalMargin } = buildSlices(instruments, quotas, requiredPKR, client.overall_margin || 0);

      if (totalCommission < requiredPKR * 0.995 && (crude100 || nasdaq)) {
        const remainder = requiredPKR - totalCommission;
        const secondProds: Product[] = [];
        if (crude100) secondProds.push(crude100);
        if (nasdaq) secondProds.push(nasdaq);

        const remainderQuotas = secondProds.map(() => remainder / Math.max(secondProds.length, 1));
        const add = buildSlices(secondProds, remainderQuotas, remainder, (client.overall_margin || 0) - totalMargin);

        for (const addSlice of add.slices) {
          const idx = slices.findIndex((s) => s.product.id === addSlice.product.id);
          if (idx >= 0) {
            slices[idx].units += addSlice.units;
            slices[idx].commissionTotal += addSlice.commissionTotal;
            slices[idx].marginTotal += addSlice.marginTotal;
          } else {
            slices.push(addSlice);
          }
        }
        totalCommission += add.totalCommission;
        totalMargin += add.totalMargin;
      }

      let totalNOTs = 0;
      for (const s of slices) s.nots = s.commissionTotal / NOT_DENOMINATOR, totalNOTs += s.nots;

      const ratio = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;
      options.push({
        label: "Option B (Gold 10oz focus)",
        slices,
        totalCommission,
        totalMargin,
        totalNOTs,
        deltaNOTs: totalNOTs - dailyTargetNOTs,
        fit: fitBadge(ratio),
      });
    }

    // ---------------- Option C: Mixed (40% Gold 1oz, 40% Crude 100bbl, 20% Nasdaq).
    // If equity > 1M AND Gold100 exists AND margin permits, allow up to 1–2 Gold100 as top-up only.
    {
      const base: Product[] = [];
      if (pick.gold1) base.push(pick.gold1);
      if (pick.crude100) base.push(pick.crude100);
      if (pick.nasdaq) base.push(pick.nasdaq);

      if (base.length) {
        const weights: number[] = base.map((p) => {
          const n = (p.name || "").toLowerCase();
          if (n.includes("gold") || n.includes("xau")) return 0.40;
          if (n.includes("crude")) return 0.40;
          return 0.20; // nasdaq
        });
        const sum = weights.reduce((a, b) => a + b, 0) || 1;
        const quotas = weights.map((w) => (w / sum) * requiredPKR);

        let { slices, totalCommission, totalMargin } = buildSlices(base, quotas, requiredPKR, client.overall_margin || 0);

        // Optional tiny Gold100 top-up
        if (
          (client.overall_margin || 0) > GOLD_100OZ_MIN_EQUITY &&
          pick.gold100
        ) {
          const { rtCommissionPerUnit, marginPerUnit } = perUnitMetrics(pick.gold100);
          let added = 0;
          while (
            totalCommission < requiredPKR * 1.02 &&
            totalMargin + marginPerUnit <= (client.overall_margin || 0) * (1 - SPARE_MARGIN_BUFFER) &&
            added < 2
          ) {
            // add 1 unit each step
            const idx = slices.findIndex((s) => s.product.id === pick.gold100!.id);
            if (idx >= 0) {
              slices[idx].units += 1;
              slices[idx].commissionTotal += rtCommissionPerUnit;
              slices[idx].marginTotal += marginPerUnit;
            } else {
              slices.push({
                product: pick.gold100!,
                units: 1,
                rtCommissionPerUnit,
                commissionTotal: rtCommissionPerUnit,
                marginPerUnit,
                marginTotal: marginPerUnit,
                nots: 0,
              });
            }
            totalCommission += rtCommissionPerUnit;
            totalMargin += marginPerUnit;
            added++;
          }
        }

        let totalNOTs = 0;
        for (const s of slices) s.nots = s.commissionTotal / NOT_DENOMINATOR, totalNOTs += s.nots;

        const ratio = dailyTargetNOTs > 0 ? (totalNOTs / dailyTargetNOTs) * 100 : 0;
        options.push({
          label: "Option C (Mixed)",
          slices,
          totalCommission,
          totalMargin,
          totalNOTs,
          deltaNOTs: totalNOTs - dailyTargetNOTs,
          fit: fitBadge(ratio),
        });
      }
    }

    return {
      client,
      dailyTargetNOTs,
      requiredCommission: requiredPKR,
      options,
    };
  }

  const plans = useMemo(() => {
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered
      .map(buildOptionsForClient)
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
          Diversified, margin-aware mixes that hit each client’s daily NOTs target
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
                plans.reduce((s, a) => s + a.dailyTargetNOTs, 0) /
                  Math.max(plans.length, 1)
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
                        {opt.fit === "perfect" && (
                          <CheckCircle className="h-5 w-5 text-trading-profit" />
                        )}
                        {opt.fit === "good" && (
                          <AlertCircle className="h-5 w-5 text-warning" />
                        )}
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
                          <span className="font-bold text-lg">
                            {formatDecimal(opt.totalNOTs)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delta vs Target:</span>
                          <span
                            className={
                              opt.deltaNOTs >= 0
                                ? "text-trading-profit font-medium"
                                : "text-trading-loss font-medium"
                            }
                          >
                            {opt.deltaNOTs >= 0 ? "+" : ""}
                            {formatDecimal(opt.deltaNOTs)} NOTs
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin Required:</span>
                          <span className="font-medium">
                            {formatCurrency(opt.totalMargin)}
                          </span>
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
