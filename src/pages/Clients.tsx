// src/pages/Clients.tsx
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Search,
  Loader2,
  Trash2,
  Filter as FilterIcon,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { Client } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { ClientForm } from "@/components/ClientForm";
import { useAuth } from "@/contexts/AuthProvider";
import { useDailyTransactions } from "@/hooks/useDailyTransactions";
import { TransactionForm } from "@/components/TransactionForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// NEW: month-year picker
import { MonthYearPicker } from "@/components/MonthYearPicker";

type SortKey = "none" | "equity" | "revenue";
type SortDir = "asc" | "desc";

export default function Clients() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { clients, loading, error, addClient, updateClient, deleteClient } = useClients();

  // Month/Year selection (1-based month)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const handleMonthYearChange = (m: number, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  // Pull month-scoped transactions from your existing hook
  // The hook already filters by date range when you pass month/year.
  const {
    transactions,
    loading: txLoading,
    error: txError,
    addTransaction,
  } = useDailyTransactions(selectedMonth, selectedYear);

  // Derive "commission only" transactions for the selected month
  const commissionTx = useMemo(
    () => transactions.filter((t) => t.transaction_type === "commission"),
    [transactions]
  );

  // Aggregate commission per client for the selected month
  const monthlyCommissions = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of commissionTx) {
      const amt = Number(t.amount ?? 0);
      map.set(t.client_id, (map.get(t.client_id) ?? 0) + amt);
    }
    return map;
  }, [commissionTx]);

  const totalMonthlyCommission = useMemo(
    () => commissionTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [commissionTx]
  );

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Filters (equity + month commission)
  const [minEquity, setMinEquity] = useState<string>("");
  const [maxEquity, setMaxEquity] = useState<string>("");
  const [minRevenue, setMinRevenue] = useState<string>(""); // interpreted as min monthly *commission*
  const [maxRevenue, setMaxRevenue] = useState<string>("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("none");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Popups
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  };

  const handleAddClient = async (
    clientData: Omit<Client, "id" | "created_at" | "updated_at">
  ) => {
    try {
      const { id, created_at, updated_at, nots_generated, ...payload } = clientData as any;
      await addClient(payload as any);
      toast({
        title: "Client Added",
        description: `${clientData.name} has been added successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to add client. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateClient = async (
    id: string,
    clientData: Omit<Client, "id" | "created_at" | "updated_at">
  ) => {
    try {
      const { id: _id, created_at, updated_at, nots_generated, ...payload } = clientData as any;
      await updateClient(id, payload as any);
      toast({
        title: "Client Updated",
        description: `${clientData.name} has been updated successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update client. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      await deleteClient(client.id);
      toast({
        title: "Client Deleted",
        description: `${client.name} has been deleted successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddTransaction = async (
    clientId: string,
    transactionType: "margin_add" | "withdrawal" | "commission",
    amount: number,
    description?: string
  ) => {
    try {
      await addTransaction(clientId, transactionType, amount, description);
      toast({
        title: "Transaction Added",
        description: `${transactionType.replace("_", " ")} of ${formatCurrency(amount)} recorded successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to add transaction. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Treat empty inputs as "no bound"
  const num = (v?: string) => {
    if (v === undefined || v === null) return undefined;
    if (String(v).trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Derived list: search + filter + sort (using month commission for "revenue")
  const visibleClients = useMemo(() => {
    const minEq = num(minEquity);
    const maxEq = num(maxEquity);
    const minRev = num(minRevenue);
    const maxRev = num(maxRevenue);

    let list = [...clients];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    // Filters
    list = list.filter((c) => {
      const equity = c.overall_margin ?? 0;
      const revenueForMonth = monthlyCommissions.get(c.id) ?? 0;

      if (minEq !== undefined && equity < minEq) return false;
      if (maxEq !== undefined && equity > maxEq) return false;
      if (minRev !== undefined && revenueForMonth < minRev) return false;
      if (maxRev !== undefined && revenueForMonth > maxRev) return false;
      return true;
    });

    // Sorting
    if (sortKey !== "none") {
      list.sort((a, b) => {
        const aVal = sortKey === "equity"
          ? (a.overall_margin ?? 0)
          : (monthlyCommissions.get(a.id) ?? 0); // month commission
        const bVal = sortKey === "equity"
          ? (b.overall_margin ?? 0)
          : (monthlyCommissions.get(b.id) ?? 0);
        const diff = aVal - bVal;
        return sortDir === "asc" ? diff : -diff;
      });
    }

    return list;
  }, [
    clients,
    searchTerm,
    minEquity,
    maxEquity,
    minRevenue,
    maxRevenue,
    sortKey,
    sortDir,
    monthlyCommissions, // important
  ]);

  // Keep your existing totals; use month commissions for “Total Revenue” display
  const totalStats = clients.reduce(
    (acc, client) => ({
      total_margin_in: acc.total_margin_in + (client.margin_in ?? 0),
      total_overall_margin: acc.total_overall_margin + (client.overall_margin ?? 0),
      total_revenue: acc.total_revenue + (client.monthly_revenue ?? 0), // not displayed below
      total_nots: acc.total_nots + (client.nots_generated ?? 0),
    }),
    { total_margin_in: 0, total_overall_margin: 0, total_revenue: 0, total_nots: 0 }
  );

  const clearFilters = () => {
    setMinEquity("");
    setMaxEquity("");
    setMinRevenue("");
    setMaxRevenue("");
  };

  const clearSorting = () => {
    setSortKey("none");
    setSortDir("desc");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CS Falcons Client Management</h1>
          <p className="text-muted-foreground">
            Manage client information and track their trading performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month/Year controls for this page */}
          <MonthYearPicker
            month={selectedMonth}
            year={selectedYear}
            onMonthYearChange={handleMonthYearChange}
          />
          {/* Non-admins shouldn't see "Add Client" */}
          <ClientForm onSubmit={handleAddClient} />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CS Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {formatCurrency(totalStats.total_margin_in)}
            </div>
          </CardContent>
        </Card>

        {/* UPDATED: month-only commissions total */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (Commission)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalMonthlyCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              For {String(selectedMonth).padStart(2, "0")}/{selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NOTs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total_nots.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls row: search + icon popups */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Icons */}
        <div className="flex items-center gap-2">
          {/* Filter popup */}
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Filters">
                <FilterIcon className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Filter Clients</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Min Equity</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 100000"
                    value={minEquity}
                    onChange={(e) => setMinEquity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Max Equity</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 500000"
                    value={maxEquity}
                    onChange={(e) => setMaxEquity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    Min Commission ({String(selectedMonth).padStart(2, "0")}/{selectedYear})
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 10000"
                    value={minRevenue}
                    onChange={(e) => setMinRevenue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    Max Commission ({String(selectedMonth).padStart(2, "0")}/{selectedYear})
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 100000"
                    value={maxRevenue}
                    onChange={(e) => setMaxRevenue(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => clearFilters()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Filters
                </Button>
                <Button type="button" onClick={() => setFilterOpen(false)}>
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Sort popup */}
          <Dialog open={sortOpen} onOpenChange={setSortOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Sort">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Sort Clients</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Sort by</label>
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Commission (Month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Direction</label>
                  <Select
                    value={sortDir}
                    onValueChange={(v) => setSortDir(v as SortDir)}
                    disabled={sortKey === "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => clearSorting()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Sorting
                </Button>
                <Button type="button" onClick={() => setSortOpen(false)}>
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading clients...
        </div>
      )}
      {error && (
        <div className="text-destructive text-sm">Failed to load clients. Please refresh.</div>
      )}

      {/* Month commission fetch state */}
      {txLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading commissions for {String(selectedMonth).padStart(2, "0")}/{selectedYear}…
        </div>
      )}
      {txError && (
        <div className="text-destructive text-sm">
          Failed to load transactions for {String(selectedMonth).padStart(2, "0")}/{selectedYear}.
        </div>
      )}

      {/* Clients List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleClients.map((client) => {
          const commissionForMonth = monthlyCommissions.get(client.id) ?? 0;

          return (
            <Card key={client.id} className="shadow-card hover:shadow-elegant transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <div className="flex gap-1">
                    <ClientForm
                      onSubmit={(data) => handleUpdateClient(client.id, data)}
                      client={client}
                      isEditing
                    />
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Client</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {client.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteClient(client)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="w-fit">
                  {(client.nots_generated ?? 0).toFixed(2)} NOTs
                </Badge>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  {client.agent && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agent:</span>
                      <span className="font-medium text-primary">{client.agent.name}</span>
                    </div>
                  )}
                  {client.is_new_client && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="default" className="text-xs">New Client</Badge>
                    </div>
                  )}
                  {client.is_new_client && (client.margin_in ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Initial Deposit:</span>
                      <span className="font-medium text-trading-profit">
                        {formatCurrency(client.margin_in)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Equity:</span>
                    <span className="font-medium text-trading-profit">
                      {formatCurrency(client.overall_margin ?? 0)}
                    </span>
                  </div>

                  {/* UPDATED: month-only commission */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Commission ({String(selectedMonth).padStart(2, "0")}/{selectedYear}):
                    </span>
                    <span className="font-medium">{formatCurrency(commissionForMonth)}</span>
                  </div>
                </div>

                {/* Admin actions */}
                {isAdmin && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex gap-2">
                      <TransactionForm
                        clientId={client.id}
                        clientName={client.name}
                        onSubmit={handleAddTransaction}
                        transactionType="margin_add"
                        buttonText="Add Margin"
                        buttonVariant="outline"
                        buttonSize="sm"
                      />
                      <TransactionForm
                        clientId={client.id}
                        clientName={client.name}
                        onSubmit={handleAddTransaction}
                        transactionType="withdrawal"
                        buttonText="Withdrawal"
                        buttonVariant="outline"
                        buttonSize="sm"
                      />
                      <TransactionForm
                        clientId={client.id}
                        clientName={client.name}
                        onSubmit={handleAddTransaction}
                        transactionType="commission"
                        buttonText="Commission"
                        buttonVariant="outline"
                        buttonSize="sm"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleClients.length === 0 && !loading && (
        <Card className="shadow-card">
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No clients found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search or filters" : "Add your first client to get started"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
