import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, DollarSign, TrendingUp, Info } from "lucide-react";
import { Product } from "@/types";
import { useProducts } from "@/hooks/useProducts";
import { ProductForm } from "@/components/ProductForm";
import { useToast } from "@/hooks/use-toast";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { products, loading, addProduct, updateProduct } = useProducts();

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'created_at'>) => {
    try {
      await addProduct(productData);
      toast({
        title: "Product Added",
        description: `${productData.name} has been added successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add product.",
        variant: "destructive"
      });
    }
  };

  // Keep sample data as fallback
  const sampleProducts: Product[] = [
    {
      id: "1",
      name: "EUR/USD",
      commission_usd: 25.00,
      tick_size: 0.00001,
      tick_value: 1.00,
      price_quote: 1.0875,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "2",
      name: "GBP/USD",
      commission_usd: 30.00,
      tick_size: 0.00001,
      tick_value: 1.00,
      price_quote: 1.2650,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "3",
      name: "USD/JPY",
      commission_usd: 25.00,
      tick_size: 0.001,
      tick_value: 1.00,
      price_quote: 149.85,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "4",
      name: "Gold (XAU/USD)",
      commission_usd: 50.00,
      tick_size: 0.01,
      tick_value: 1.00,
      price_quote: 2045.50,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "5",
      name: "Silver (XAG/USD)",
      commission_usd: 40.00,
      tick_size: 0.001,
      tick_value: 1.00,
      price_quote: 24.85,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "6",
      name: "S&P 500",
      commission_usd: 40.00,
      tick_size: 0.25,
      tick_value: 12.50,
      price_quote: 4575.25,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "7",
      name: "NASDAQ 100",
      commission_usd: 45.00,
      tick_size: 0.25,
      tick_value: 5.00,
      price_quote: 15850.75,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "8",
      name: "Bitcoin (BTC/USD)",
      commission_usd: 75.00,
      tick_size: 1.00,
      tick_value: 1.00,
      price_quote: 43250.00,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "9",
      name: "Ethereum (ETH/USD)",
      commission_usd: 50.00,
      tick_size: 0.01,
      tick_value: 1.00,
      price_quote: 2680.50,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "10",
      name: "Tesla (TSLA)",
      commission_usd: 30.00,
      tick_size: 0.01,
      tick_value: 1.00,
      price_quote: 248.50,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "11",
      name: "Apple (AAPL)",
      commission_usd: 25.00,
      tick_size: 0.01,
      tick_value: 1.00,
      price_quote: 192.75,
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "12",
      name: "WTI Crude Oil",
      commission_usd: 45.00,
      tick_size: 0.01,
      tick_value: 1.00,
      price_quote: 78.50,
      created_at: "2024-01-01T00:00:00Z"
    }
  ];

  const displayProducts = products.length > 0 ? products : sampleProducts;
  
  const filteredProducts = useMemo(() => {
    return displayProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [displayProducts, searchTerm]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getProductCategory = (name: string) => {
    if (name.includes('/')) {
      if (name.includes('USD') || name.includes('EUR') || name.includes('GBP')) {
        return { label: 'Forex', variant: 'default' as const };
      }
    }
    if (name.includes('Gold') || name.includes('Silver') || name.includes('Oil')) {
      return { label: 'Commodities', variant: 'secondary' as const };
    }
    if (name.includes('S&P') || name.includes('NASDAQ') || name.includes('Dow')) {
      return { label: 'Indices', variant: 'outline' as const };
    }
    if (name.includes('Bitcoin') || name.includes('Ethereum')) {
      return { label: 'Crypto', variant: 'destructive' as const };
    }
    return { label: 'Stocks', variant: 'secondary' as const };
  };

  const stats = {
    total_products: displayProducts.length,
    avg_commission: displayProducts.reduce((sum, p) => sum + p.commission_usd, 0) / displayProducts.length,
    highest_commission: Math.max(...displayProducts.map(p => p.commission_usd)),
    categories: [...new Set(displayProducts.map(p => getProductCategory(p.name).label))].length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Product Catalog</h1>
        <p className="text-muted-foreground">
          Search and explore trading products with commission rates and market data
        </p>
      </div>
      
      <div className="flex justify-end">
        <ProductForm onSubmit={handleAddProduct} />
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_products}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avg_commission)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(stats.highest_commission)}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categories}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => {
          const category = getProductCategory(product.name);
          return (
            <Card key={product.id} className="shadow-card hover:shadow-elegant transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <Badge variant={category.variant} className="ml-2">
                    {category.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Commission:</span>
                    <span className="font-bold text-trading-profit">
                      {formatCurrency(product.commission_usd)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Price:</span>
                    <span className="font-medium">
                      {product.price_quote.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4
                      })}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Tick Size:</span>
                      <span className="font-mono">
                        {product.tick_size.toFixed(product.tick_size < 0.001 ? 5 : 3)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Tick Value:</span>
                      <span className="font-mono">
                        {formatCurrency(product.tick_value)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No products found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria to find the products you're looking for
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}