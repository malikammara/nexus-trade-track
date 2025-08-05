import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Users, 
  TrendingUp, 
  DollarSign,
  Target,
  Search
} from "lucide-react";
import { Client } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function Clients() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([
    {
      id: "1",
      name: "Ahmed Khan Trading Co.",
      margin_in: 185000,
      overall_margin: 220000,
      invested_amount: 1500000,
      monthly_revenue: 75000,
      nots_generated: 12,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z"
    },
    {
      id: "2", 
      name: "Karachi Investment Group",
      margin_in: 320000,
      overall_margin: 380000,
      invested_amount: 2200000,
      monthly_revenue: 95000,
      nots_generated: 15,
      created_at: "2024-01-20T14:30:00Z",
      updated_at: "2024-01-20T14:30:00Z"
    }
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    margin_in: "",
    overall_margin: "",
    invested_amount: "",
    monthly_revenue: ""
  });

  const calculateNOTs = (marginIn: number) => {
    return Math.floor(marginIn / 6000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const margin_in = parseFloat(formData.margin_in) || 0;
    const nots_generated = calculateNOTs(margin_in);
    
    const clientData = {
      name: formData.name,
      margin_in,
      overall_margin: parseFloat(formData.overall_margin) || 0,
      invested_amount: parseFloat(formData.invested_amount) || 0,
      monthly_revenue: parseFloat(formData.monthly_revenue) || 0,
      nots_generated,
      updated_at: new Date().toISOString()
    };

    if (editingClient) {
      setClients(clients.map(client => 
        client.id === editingClient.id 
          ? { ...client, ...clientData }
          : client
      ));
      toast({
        title: "Client Updated",
        description: `${clientData.name} has been updated successfully.`,
      });
    } else {
      const newClient: Client = {
        ...clientData,
        id: Date.now().toString(),
        created_at: new Date().toISOString()
      };
      setClients([...clients, newClient]);
      toast({
        title: "Client Added",
        description: `${clientData.name} has been added successfully.`,
      });
    }

    setFormData({
      name: "",
      margin_in: "",
      overall_margin: "",
      invested_amount: "",
      monthly_revenue: ""
    });
    setEditingClient(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      margin_in: client.margin_in.toString(),
      overall_margin: client.overall_margin.toString(),
      invested_amount: client.invested_amount.toString(),
      monthly_revenue: client.monthly_revenue.toString()
    });
    setIsDialogOpen(true);
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingClient(null);
                setFormData({
                  name: "",
                  margin_in: "",
                  overall_margin: "",
                  invested_amount: "",
                  monthly_revenue: ""
                });
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter client name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="margin_in">Margin In (PKR)</Label>
                  <Input
                    id="margin_in"
                    type="number"
                    value={formData.margin_in}
                    onChange={(e) => setFormData(prev => ({ ...prev, margin_in: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overall_margin">Overall Margin (PKR)</Label>
                  <Input
                    id="overall_margin"
                    type="number"
                    value={formData.overall_margin}
                    onChange={(e) => setFormData(prev => ({ ...prev, overall_margin: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invested_amount">Invested Amount (PKR)</Label>
                  <Input
                    id="invested_amount"
                    type="number"
                    value={formData.invested_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, invested_amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly_revenue">Monthly Revenue (PKR)</Label>
                  <Input
                    id="monthly_revenue"
                    type="number"
                    value={formData.monthly_revenue}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_revenue: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              {formData.margin_in && (
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    NOTs Generated: <span className="font-medium">{calculateNOTs(parseFloat(formData.margin_in))}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingClient ? "Update Client" : "Add Client"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(client)}
                  className="h-8 w-8"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="secondary" className="w-fit">
                {client.nots_generated} NOTs
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CS Margin:</span>
                  <span className="font-medium text-trading-profit">
                    {formatCurrency(client.margin_in)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overall Margin:</span>
                  <span className="font-medium">
                    {formatCurrency(client.overall_margin)}
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