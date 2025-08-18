import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Brain, 
  Calculator, 
  DollarSign, 
  Target, 
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles
} from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TradeOption {
  option_id: number;
  trades: Array<{
    product: string;
    lots: number;
    commission_usd: number;
  }>;
  total_commission_usd: number;
  total_commission_pkr: number;
  nots_achieved: number;
  margin_used_usd: number;
}

interface GeminiResponse {
  options: TradeOption[];
}

const GEMINI_API_KEY = "AIzaSyDXKxWsoixA2tThgIDp_yFdX_F7WhoAC38";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export default function AdvancedTradeSuggestions() {
  const { products, loading: productsLoading } = useProducts();
  const { toast } = useToast();

  // Form state
  const [requiredNOTs, setRequiredNOTs] = useState<number>(5);
  const [clientEquity, setClientEquity] = useState<number>(10000);
  const [usdToPkr, setUsdToPkr] = useState<number>(280);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // AI response state
  const [suggestions, setSuggestions] = useState<TradeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default selected products
  const defaultProducts = ["Gold-1oz (XAU/USD)", "Gold-10oz", "Nasdaq-100 Index"];

  useEffect(() => {
    if (products.length > 0) {
      // Auto-select default products if they exist
      const availableDefaults = products
        .filter(p => 
          p.name.toLowerCase().includes("gold") && p.name.includes("1oz") ||
          p.name.toLowerCase().includes("gold") && p.name.includes("10oz") ||
          p.name.toLowerCase().includes("nasdaq")
        )
        .map(p => p.name);
      
      setSelectedProducts(availableDefaults.length > 0 ? availableDefaults : []);
    }
  }, [products]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'PKR') {
      return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDecimal = (value: number, decimals: number = 2) => {
    return Number(value || 0).toFixed(decimals);
  };

  const handleProductToggle = (productName: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productName]);
    } else {
      setSelectedProducts(prev => prev.filter(p => p !== productName));
    }
  };

  const buildGeminiPrompt = () => {
    const selectedProductsData = products
      .filter(p => selectedProducts.includes(p.name))
      .map(p => `${p.name}: ${p.commission_usd} USD`)
      .join(", ");

    return `You are a financial trading assistant specialized in generating trade suggestions based on commission targets. The goal is to achieve a total commission generated equivalent to the required NOTs, where 1 NOT = 6000 PKR in commission (assume an exchange rate of 1 USD = ${usdToPkr} PKR for conversions unless specified otherwise; adjust calculations accordingly). Each trade is assumed to involve opening and closing (two sides), so total commission per trade = 2 * commission per side. Suggestions must respect the client's equity by ensuring the combined margin required for the trades does not exceed the equity (assume standard margin requirements: e.g., 1% margin for forex like USD/JPY, 5% for commodities like gold/crude, 10% for indices like Nasdaq100, based on a 1:100 leverage; use approximate contract sizes: Gold1oz=100 USD/point, Gold10oz=1000 USD/point, Nasdaq100=20 USD/point, Crude100barrels=1000 USD/point, USD/JPY=1000 USD/point per lot).

Input data:
Products and commissions per side: [${selectedProductsData}]
Required NOTs: ${requiredNOTs}
Client's equity: ${clientEquity} USD

Generate exactly three distinct trade suggestion options. Each option should be a combination of 2-4 different products from the list, specifying the number of lots/trades for each product, the total commission generated in USD and PKR, the total NOTs achieved (rounded to nearest whole number), and the estimated margin used (ensure it's <= client's equity). Vary the combinations across options for diversity (e.g., one heavy on commodities, one on forex/indices). Prioritize options that exactly or closely meet the required NOTs without exceeding equity.

Output strictly as JSON in this structure:
{
"options": [
{
"option_id": 1,
"trades": [
{"product": "Gold1oz", "lots": 10, "commission_usd": 20},
{"product": "Nasdaq100", "lots": 5, "commission_usd": 50}
],
"total_commission_usd": 70,
"total_commission_pkr": 19600,
"nots_achieved": 3,
"margin_used_usd": 5000
}
]
}
Do not include any additional text outside the JSON.`;
  };

  const generateSuggestions = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product for trade suggestions.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const prompt = buildGeminiPrompt();
      
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error("No response from Gemini AI");
      }

      // Parse JSON response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid JSON response from AI");
      }

      const aiResponse: GeminiResponse = JSON.parse(jsonMatch[0]);
      setSuggestions(aiResponse.options || []);

      toast({
        title: "AI Suggestions Generated",
        description: `Generated ${aiResponse.options?.length || 0} trade options for ${requiredNOTs} NOTs target.`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate suggestions";
      setError(errorMessage);
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getOptionBadgeVariant = (nots: number, target: number) => {
    const ratio = (nots / target) * 100;
    if (ratio >= 95 && ratio <= 105) return "default"; // Perfect
    if (ratio >= 85 && ratio <= 115) return "secondary"; // Good
    return "outline"; // Needs adjustment
  };

  const getOptionLabel = (nots: number, target: number) => {
    const ratio = (nots / target) * 100;
    if (ratio >= 95 && ratio <= 105) return "Perfect Match";
    if (ratio >= 85 && ratio <= 115) return "Good Option";
    return "Consider Adjustment";
  };

  if (productsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Advanced Trade Suggestions</h1>
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          Advanced Trade Suggestions
        </h1>
        <p className="text-muted-foreground">
          AI-powered trade recommendations using Google Gemini to achieve your NOTs targets
        </p>
      </div>

      {/* Input Form */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Trade Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="required-nots">Required NOTs</Label>
              <Input
                id="required-nots"
                type="number"
                step="0.01"
                value={requiredNOTs}
                onChange={(e) => setRequiredNOTs(parseFloat(e.target.value) || 0)}
                placeholder="5.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-equity">Client Equity (USD)</Label>
              <Input
                id="client-equity"
                type="number"
                step="100"
                value={clientEquity}
                onChange={(e) => setClientEquity(parseFloat(e.target.value) || 0)}
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usd-rate">USD to PKR Rate</Label>
              <Input
                id="usd-rate"
                type="number"
                step="0.01"
                value={usdToPkr}
                onChange={(e) => setUsdToPkr(parseFloat(e.target.value) || 280)}
                placeholder="280.00"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Select Products for Analysis</Label>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div key={product.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={product.id}
                    checked={selectedProducts.includes(product.name)}
                    onCheckedChange={(checked) => 
                      handleProductToggle(product.name, checked as boolean)
                    }
                  />
                  <Label 
                    htmlFor={product.id} 
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {product.name}
                    <span className="text-muted-foreground ml-2">
                      (${product.commission_usd})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Default products (Gold-1oz, Gold-10oz, Nasdaq-100) are pre-selected
            </p>
          </div>

          <Button 
            onClick={generateSuggestions} 
            disabled={loading || selectedProducts.length === 0}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating AI Suggestions...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Trade Suggestions
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">AI-Generated Trade Options</h2>
            <Badge variant="secondary">{suggestions.length} Options</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
            {suggestions.map((option) => (
              <Card 
                key={option.option_id} 
                className={cn(
                  "shadow-card border-2 transition-colors",
                  getOptionBadgeVariant(option.nots_achieved, requiredNOTs) === "default" && "border-trading-profit bg-trading-profit/5",
                  getOptionBadgeVariant(option.nots_achieved, requiredNOTs) === "secondary" && "border-warning bg-warning/5"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Option {option.option_id}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getOptionBadgeVariant(option.nots_achieved, requiredNOTs)}>
                        {getOptionLabel(option.nots_achieved, requiredNOTs)}
                      </Badge>
                      {getOptionBadgeVariant(option.nots_achieved, requiredNOTs) === "default" && (
                        <CheckCircle className="h-4 w-4 text-trading-profit" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Trades Breakdown */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Recommended Trades:</h4>
                    {option.trades.map((trade, idx) => (
                      <div key={idx} className="flex justify-between text-sm bg-accent/50 p-2 rounded">
                        <span>{trade.product}</span>
                        <span className="font-medium">{trade.lots} lots</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary Metrics */}
                  <div className="space-y-2 text-sm border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Commission:</span>
                      <span className="font-medium">{formatCurrency(option.total_commission_usd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commission (PKR):</span>
                      <span className="font-medium">{formatCurrency(option.total_commission_pkr, 'PKR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NOTs Achieved:</span>
                      <span className="font-bold text-lg text-trading-profit">
                        {formatDecimal(option.nots_achieved)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin Used:</span>
                      <span className="font-medium">{formatCurrency(option.margin_used_usd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin Utilization:</span>
                      <span className="font-medium">
                        {formatDecimal((option.margin_used_usd / clientEquity) * 100)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatDecimal(requiredNOTs)}</div>
              <div className="text-sm text-muted-foreground">Target NOTs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatCurrency(clientEquity)}</div>
              <div className="text-sm text-muted-foreground">Client Equity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedProducts.length}</div>
              <div className="text-sm text-muted-foreground">Products Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-trading-profit">{suggestions.length}</div>
              <div className="text-sm text-muted-foreground">AI Options Generated</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}