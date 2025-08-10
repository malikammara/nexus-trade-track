import { useState } from "react";
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
  Trash2
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

export default function Clients() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { clients, loading, error, addClient, updateClient, deleteClient } = useClients();
  const { addTransaction } = useDailyTransactions();
  const [searchTerm, setSearchTerm] = useState("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await addClient(clientData);
      toast({
        title: "Client Added",
        description: `${clientData.name} has been added successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add client. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateClient = async (id: string, clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await updateClient(id, clientData);
      toast({
        title: "Client Updated",
        description: `${clientData.name} has been updated successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update client. Please try again.",
        variant: "destructive"
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAddTransaction = async (
    clientId: string,
    transactionType: 'margin_add' | 'withdrawal' | 'commission',
    amount: number,
    description?: string
  ) => {
    try {
      await addTransaction(clientId, transactionType, amount, description);
      toast({
        title: "Transaction Added",
        description: `${transactionType.replace('_', ' ')} of ${formatCurrency(amount)} recorded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add transaction. Please try again.",
        variant: "destructive"
      });
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStats = clients.reduce((acc, client) => ({
    total_margin_in: acc.total_margin_in + client.margin_in,
    total_overall_margin: acc.total_overall_margin + client.overall_margin,
    total_revenue: acc.total_revenue + client.monthly_revenue,
    total_nots: acc.total_nots + client.nots_generated
  }), { total_margin_in: 0, total_overall_margin: 0, total_revenue: 0, total_nots: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Client Management</h1>
          <p className="text-muted-foreground">
            Manage client information and track their trading performance
          </p>
        </div>

        <ClientForm onSubmit={handleAddClient} />
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

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalStats.total_revenue)}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NOTs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total_nots}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Clients List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredClients.map((client) => (
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
                {client.nots_generated} NOTs
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Equity:</span>
                  <span className="font-medium text-trading-profit">
                    {formatCurrency(client.overall_margin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initial Margin:</span>
                  <span className="font-medium">
                    {formatCurrency(client.margin_in)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invested:</span>
                  <span className="font-medium">
                    {formatCurrency(client.invested_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Revenue:</span>
                  <span className="font-medium">
                    {formatCurrency(client.monthly_revenue)}
                  </span>
                </div>
              </div>
              
              {/* Transaction Actions */}
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
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No clients found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search criteria" : "Add your first client to get started"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}