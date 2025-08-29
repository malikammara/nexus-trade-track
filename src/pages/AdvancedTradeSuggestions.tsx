import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Brain, 
  Calculator, 
  Target, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * ======================
 * Types
 * ======================
 */
interface TradeOption {
  option_id: number;
  trades: Array<{
    product: string;
    lots: number;
    commission_usd: number; // per side
  }>;
  total_commission_usd: number;
  total_commission_pkr: number;
  nots_achieved: number;
  margin_used_usd: number;
  // Added but optional: we compute if Gemini doesn't return
  margin_used_pkr?: number;
}

interface GeminiResponse {
  options: TradeOption[];
}

/**
 * ======================
 * Config
 * ======================
 */

// Prefer calling a serverless route you control (recommended):
// const APP_API_URL = "/api/gemini-trade-suggestions";
//
// If you insist on client-side (not recommended), use a public env var ONLY for local dev.
const GEMINI_API_KEY = import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyDXKxWsoixA2tThgIDp_yFdX_F7WhoAC38'; 
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * ======================
 * Component
 * ======================
 */

export default function AdvancedTradeSuggestions() {
  const { products, loading: productsLoading } = useProducts();
  const { toast } = useToast();

  // ---- Form state (PKR-first UX) ----
  const [requiredNOTs, setRequiredNOTs] = useState<number>(5);
  const [clientEquityPKR, setClientEquityPKR] = useState<number>(3_000_000); // PKR input
  const [usdToPkr, setUsdToPkr] = useState<number>(280);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showProducts, setShowProducts] = useState<boolean>(false);

  // ---- AI response state ----
  const [suggestions, setSuggestions] = useState<TradeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-select a sensible small default set (less clutter)
  useEffect(() => {
    if (products.length > 0) {
      const defaults = products
        .filter((p) =>
          /gold.*1oz|gold.*10oz|nasdaq|nasdaq-100/i.test(p.name)
        )
        .slice(0, 3)
        .map((p) => p.name);
      setSelectedProducts(defaults);
    }
  }, [products]);

  // ---- Helpers ----
  const toUSD = (pkr: number) => (usdToPkr > 0 ? pkr / usdToPkr : 0);
  const toPKR = (usd: number) => usd * usdToPkr;

  const clientEquityUSD = useMemo(() => toUSD(clientEquityPKR), [clientEquityPKR, usdToPkr]);

  const formatPKR = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatUSD = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const formatPct = (val: number) => `${(Number(val || 0)).toFixed(1)}%`;

  const handleProductToggle = (name: string, checked: boolean) => {
    setSelectedProducts((prev) =>
      checked ? Array.from(new Set([...prev, name])) : prev.filter((p) => p !== name)
    );
  };

  // Runtime validation to harden against messy LLM JSON
  const validateOptions = (obj: unknown): TradeOption[] => {
    try {
      const root = obj as GeminiResponse;
      if (!root || !Array.isArray(root.options)) return [];
      const clean = root.options
        .map((o) => {
          const option_id = Number(o.option_id);
          const trades = Array.isArray(o.trades)
            ? o.trades
                .map((t) => ({
                  product: String(t.product ?? ""),
                  lots: Math.max(0, Number(t.lots ?? 0)),
                  commission_usd: Math.max(0, Number(t.commission_usd ?? 0)),
                }))
                .filter((t) => t.product && t.lots > 0 && t.commission_usd >= 0)
            : [];
          const total_commission_usd = Math.max(0, Number(o.total_commission_usd ?? 0));
          const total_commission_pkr = Math.max(0, Number(o.total_commission_pkr ?? 0));
          const nots_achieved = Math.max(0, Number(o.nots_achieved ?? 0));
          const margin_used_usd = Math.max(0, Number(o.margin_used_usd ?? 0));

          return {
            option_id: Number.isFinite(option_id) ? option_id : 0,
            trades,
            total_commission_usd,
            total_commission_pkr,
            nots_achieved,
            margin_used_usd,
          };
        })
        .filter((o) => o.option_id > 0 && o.trades.length > 0);
      return clean;
    } catch {
      return [];
    }
  };

  const getOptionBadgeVariant = (nots: number, target: number) => {
    const ratio = (nots / Math.max(target, 0.001)) * 100;
    if (ratio >= 95 && ratio <= 105) return "default";
    if (ratio >= 85 && ratio <= 115) return "secondary";
    return "outline";
  };

  const getOptionLabel = (nots: number, target: number) => {
    const ratio = (nots / Math.max(target, 0.001)) * 100;
    if (ratio >= 95 && ratio <= 105) return "Perfect Match";
    if (ratio >= 85 && ratio <= 115) return "Good Option";
    return "Consider Adjustment";
  };

  // Build a stricter prompt to improve JSON quality and PKR targeting
  const buildGeminiPrompt = () => {
    const selectedProductsData = products
      .filter((p) => selectedProducts.includes(p.name))
      .map((p) => `${p.name} (commission_per_side_usd=${p.commission_usd})`)
      .join(", ");

    // NOTE: 1 NOT = 6,000 PKR of commission (target unit is PKR)
    // Commissions per side are in USD, but the goal is in PKR; model must convert using usdToPkr
    return `
You are a financial trading assistant. Generate trade suggestion OPTIONS to reach a commission TARGET in Pakistan Rupees (PKR).
- Target unit: NOTs, where 1 NOT = 6000 PKR of TOTAL commission.
- Commission accounting: each trade has two sides (open + close) so commission_per_trade_usd = 2 * commission_per_side_usd.
- Use usd_to_pkr = ${usdToPkr} for conversions. All conversions MUST be precise.
- Products allowed (name must match exactly) with commission_per_side_usd:
  [${selectedProductsData}]
- Risk/Margin constraints (approx):
  • Forex (e.g., USD/JPY): 1% margin (1:100 leverage)
  • Commodities (e.g., Gold/Crude): 5%
  • Indices (e.g., Nasdaq100): 10%
- Approx contract sizes:
  • Gold-1oz ≈ 100 USD/point
  • Gold-10oz ≈ 1000 USD/point
  • Nasdaq-100 Index ≈ 20 USD/point
  • Crude-100barrels ≈ 1000 USD/point
  • USD/JPY ≈ 1000 USD/point per lot

INPUT:
- required_nots = ${requiredNOTs}
- client_equity_usd = ${clientEquityUSD}

REQUIREMENTS:
- Generate EXACTLY 3 options.
- Each option uses 2–4 distinct products from the allowed list.
- For each product, specify integer lots >= 1.
- Ensure estimated margin_used_usd <= client_equity_usd.
- Maximize closeness to required_nots without exceeding margin/equity.
- Vary composition across options (e.g., commodity-heavy, index/forex-heavy, mixed).
- OUTPUT FIELDS per option:
  • option_id (1..3)
  • trades[]: { product, lots, commission_usd } // commission_usd = per-side commission in USD
  • total_commission_usd (sum of all trades * two sides)
  • total_commission_pkr (converted using usd_to_pkr)
  • nots_achieved = round(total_commission_pkr / 6000)
  • margin_used_usd (estimated)

STRICT OUTPUT:
Return ONLY JSON in this exact shape, with no extra commentary:

{
  "options": [
    {
      "option_id": 1,
      "trades": [
        {"product": "Gold-1oz (XAU/USD)", "lots": 10, "commission_usd": 20}
      ],
      "total_commission_usd": 400,
      "total_commission_pkr": 112000,
      "nots_achieved": 19,
      "margin_used_usd": 5000
    },
    { "option_id": 2, "trades": [...], "total_commission_usd": ..., "total_commission_pkr": ..., "nots_achieved": ..., "margin_used_usd": ... },
    { "option_id": 3, "trades": [...], "total_commission_usd": ..., "total_commission_pkr": ..., "nots_achieved": ..., "margin_used_usd": ... }
  ]
}
`.trim();
  };

  // Robust fetch with timeout + retries for transient failures
  const fetchWithRetry = async (req: RequestInfo, init: RequestInit, retries = 2, timeoutMs = 25_000) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      abortRef.current = controller;

      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(req, { ...init, signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) return res;
        // Retry on 429/5xx
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          if (attempt < retries) {
            // backoff 800ms, then 1600ms...
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
            continue;
          }
        }
        // Non-retryable error
        return res;
      } catch (e: any) {
        clearTimeout(timeout);
        if (e?.name === "AbortError") throw e;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    // Shouldn't reach
    throw new Error("Unexpected fetch error");
  };

  const generateSuggestions = async () => {
    if (!selectedProducts.length) {
      toast({
        title: "Select products",
        description: "Pick at least one product to analyze.",
        variant: "destructive",
      });
      return;
    }

    if (!GEMINI_API_KEY) {
      setError("Missing NEXT_PUBLIC_GEMINI_API_KEY. Prefer using a serverless route to protect keys.");
      toast({
        title: "Configuration error",
        description: "API key missing. Set NEXT_PUBLIC_GEMINI_API_KEY or use /api proxy.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const prompt = buildGeminiPrompt();

      const res = await fetchWithRetry(
        `${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
            },
          }),
        },
        /* retries */ 2,
        /* timeoutMs */ 25_000
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini API error ${res.status}${text ? `: ${text}` : ""}`);
      }

      const data = await res.json();
      const generatedText: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error("Empty response from Gemini");
      }

      // Extract first JSON object in the text
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON from model");

      const parsed = JSON.parse(jsonMatch[0]) as GeminiResponse;
      let clean = validateOptions(parsed);

      // Fill any missing PKR/margin PKR and ensure NOTs are aligned to our rate
      clean = clean.map((o) => {
        const total_commission_pkr =
          Number.isFinite(o.total_commission_pkr) && o.total_commission_pkr > 0
            ? o.total_commission_pkr
            : toPKR(o.total_commission_usd);

        const nots_achieved =
          Number.isFinite(o.nots_achieved) && o.nots_achieved > 0
            ? o.nots_achieved
            : Math.round(total_commission_pkr / 6000);

        const margin_used_pkr = toPKR(o.margin_used_usd);

        return {
          ...o,
          total_commission_pkr,
          nots_achieved,
          margin_used_pkr,
        };
      });

      if (!clean.length) throw new Error("Model returned no valid options");

      setSuggestions(clean);

      toast({
        title: "Suggestions ready",
        description: `Generated ${clean.length} option${clean.length > 1 ? "s" : ""} for target ${requiredNOTs} NOTs.`,
      });
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? "Request cancelled"
          : err?.message || "Failed to generate suggestions";
      setError(msg);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const cancelRequest = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  if (productsLoading) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          Advanced Trade Suggestions
        </h1>
        <p className="text-muted-foreground">Loading products…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          CS Falcons Advanced Trade Suggestions
        </h1>
        <p className="text-muted-foreground">
          Streamlined AI recommendations to hit NOTs (PKR-first). Commissions remain in USD.
        </p>
      </div>

      {/* Form (compact) */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Trade Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="required-nots">Required NOTs</Label>
              <Input
                id="required-nots"
                type="number"
                step="1"
                min={0}
                value={requiredNOTs}
                onChange={(e) => setRequiredNOTs(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-equity-pkr">Client Equity (PKR)</Label>
              <Input
                id="client-equity-pkr"
                type="number"
                step="1000"
                min={0}
                value={clientEquityPKR}
                onChange={(e) => setClientEquityPKR(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="3000000"
              />
              <div className="text-xs text-muted-foreground">
                ≈ {formatUSD(clientEquityUSD)} at {usdToPkr.toFixed(2)} PKR/USD
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usd-rate">USD ⇄ PKR</Label>
              <Input
                id="usd-rate"
                type="number"
                step="0.01"
                min={1}
                value={usdToPkr}
                onChange={(e) => setUsdToPkr(Math.max(1, parseFloat(e.target.value) || 280))}
                placeholder="280.00"
              />
              <div className="text-xs text-muted-foreground">Used for conversion & NOTs calc</div>
            </div>
          </div>

          {/* Product picker – collapsed by default to keep page clean */}
          <div className="border rounded-md">
            <button
              type="button"
              onClick={() => setShowProducts((s) => !s)}
              className="w-full flex items-center justify-between px-3 py-2"
            >
              <span className="text-sm font-medium">Products ({selectedProducts.length} selected)</span>
              {showProducts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showProducts && (
              <div className="p-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[320px] overflow-auto">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id={product.id}
                      checked={selectedProducts.includes(product.name)}
                      onCheckedChange={(checked) =>
                        handleProductToggle(product.name, Boolean(checked))
                      }
                    />
                    <div className="text-sm flex-1">
                      <div className="font-medium leading-snug">{product.name}</div>
                      <div className="text-muted-foreground">
                        Commission/side: {formatUSD(product.commission_usd)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generateSuggestions}
              disabled={loading || selectedProducts.length === 0}
              className="flex-1"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Suggestions
                </>
              )}
            </Button>
            {loading && (
              <Button variant="secondary" onClick={cancelRequest}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">AI Trade Options</h2>
            <Badge variant="secondary">{suggestions.length} options</Badge>
          </div>

          {/* One column to reduce clutter; cards contain only the essentials */}
          <div className="grid gap-4">
            {suggestions.map((option) => {
              const variant = getOptionBadgeVariant(option.nots_achieved, requiredNOTs);
              const label = getOptionLabel(option.nots_achieved, requiredNOTs);
              const marginUsedPKR = option.margin_used_pkr ?? toPKR(option.margin_used_usd);
              const marginUtil = clientEquityPKR > 0 ? (marginUsedPKR / clientEquityPKR) * 100 : 0;

              return (
                <Card
                  key={option.option_id}
                  className={cn(
                    "shadow-card border-2 transition-colors",
                    variant === "default" && "border-trading-profit bg-trading-profit/5",
                    variant === "secondary" && "border-warning bg-warning/5"
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Option {option.option_id}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={variant}>{label}</Badge>
                        {variant === "default" && (
                          <CheckCircle className="h-4 w-4 text-trading-profit" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Essentials only */}
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Commission (PKR):</span>
                        <span className="font-semibold">
                          {formatPKR(option.total_commission_pkr)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NOTs Achieved:</span>
                        <span className="font-semibold">{option.nots_achieved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Margin Used:</span>
                        <span className="font-medium">
                          {formatPKR(marginUsedPKR)} ({formatPct(marginUtil)})
                        </span>
                      </div>
                    </div>

                    {/* Minimal trades list */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Trades</div>
                      <div className="grid gap-1">
                        {option.trades.map((t, idx) => (
                          <div
                            key={`${t.product}-${idx}`}
                            className="flex items-center justify-between text-sm bg-accent/40 px-2 py-1 rounded"
                          >
                            <span className="truncate">{t.product}</span>
                            <span className="font-medium">{t.lots} lots</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        USD commission (model): {formatUSD(option.total_commission_usd)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{requiredNOTs}</div>
              <div className="text-sm text-muted-foreground">Target NOTs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatPKR(clientEquityPKR)}</div>
              <div className="text-sm text-muted-foreground">Client Equity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedProducts.length}</div>
              <div className="text-sm text-muted-foreground">Products Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-trading-profit">{suggestions.length}</div>
              <div className="text-sm text-muted-foreground">Options Generated</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
