import { useState, useMemo } from "react";
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
  Phone,
  Mail,
  UserCheck,
  UserX,
} from "lucide-react";
import { Agent, Client } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAgents } from "@/hooks/useAgents";
import { useClients } from "@/hooks/useClients";
import { AgentForm } from "@/components/AgentForm";
import { ClientAgentLinkForm } from "@/components/ClientAgentLinkForm";
import { useAuth } from "@/contexts/AuthProvider";
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
} from "@/components/ui/dialog";

export default function Agents() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { agents, loading, error, addAgent, updateAgent, deleteAgent, getAgentClients } = useAgents();
  const { clients } = useClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentClients, setAgentClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const handleAddAgent = async (
    agentData: Omit<Agent, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await addAgent(agentData);
      toast({
        title: "Agent Added",
        description: `${agentData.name} has been added successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to add agent. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAgent = async (
    id: string,
    agentData: Omit<Agent, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await updateAgent(id, agentData);
      toast({
        title: "Agent Updated",
        description: `${agentData.name} has been updated successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update agent. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    try {
      await deleteAgent(agent.id);
      toast({
        title: "Agent Deleted",
        description: `${agent.name} has been deleted successfully.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewAgentClients = async (agent: Agent) => {
    setSelectedAgent(agent);
    setClientsLoading(true);
    try {
      const clients = await getAgentClients(agent.id);
      setAgentClients(clients);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load agent clients.",
        variant: "destructive",
      });
    } finally {
      setClientsLoading(false);
    }
  };

  const visibleAgents = useMemo(() => {
    return agents.filter((agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [agents, searchTerm]);

  const totalStats = agents.reduce(
    (acc, agent) => ({
      total_agents: acc.total_agents + 1,
      active_agents: acc.active_agents + (agent.is_active ? 1 : 0),
      total_clients: acc.total_clients + (agent.client_count || 0),
      total_revenue: acc.total_revenue + (agent.total_client_revenue || 0),
      total_commission: acc.total_commission + (agent.estimated_commission || 0),
    }),
    { total_agents: 0, active_agents: 0, total_clients: 0, total_revenue: 0, total_commission: 0 }
  );

  const unlinkedClients = clients.filter(c => !c.agent_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Management</h1>
          <p className="text-muted-foreground">
            Manage agents and track their client performance
          </p>
        </div>

        <div className="flex gap-2">
          {isAdmin && <AgentForm onSubmit={handleAddAgent} />}
          <ClientAgentLinkForm />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total_agents}</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.active_agents} active
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managed Clients</CardTitle>
            <UserCheck className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">
              {totalStats.total_clients}
            </div>
            <p className="text-xs text-muted-foreground">
              {unlinkedClients.length} unlinked
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalStats.total_revenue)}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalStats.total_commission)}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unlinked Clients</CardTitle>
            <UserX className="h-4 w-4 text-trading-loss" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-loss">
              {unlinkedClients.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agents...
        </div>
      )}
      {error && (
        <div className="text-destructive text-sm">Failed to load agents. Please refresh.</div>
      )}

      {/* Agents List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleAgents.map((agent) => (
          <Card key={agent.id} className="shadow-card hover:shadow-elegant transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={agent.is_active ? "default" : "secondary"}>
                      {agent.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  {isAdmin && (
                    <>
                      <AgentForm
                        onSubmit={(data) => handleUpdateAgent(agent.id, data)}
                        agent={agent}
                        isEditing
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {agent.name}? This will unlink all their clients.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAgent(agent)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                {agent.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{agent.phone}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clients:</span>
                  <span className="font-medium">{agent.client_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Revenue:</span>
                  <span className="font-medium text-trading-profit">
                    {formatCurrency(agent.total_client_revenue || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total NOTs:</span>
                  <span className="font-medium">
                    {(agent.total_client_nots || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleViewAgentClients(agent)}
                >
                  View Clients ({agent.client_count || 0})
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleAgents.length === 0 && !loading && (
        <Card className="shadow-card">
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search" : "Add your first agent to get started"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Agent Clients Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAgent?.name} - Clients ({agentClients.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {clientsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading clients...
              </div>
            ) : agentClients.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {agentClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium">{client.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Equity: {formatCurrency(client.overall_margin)} • 
                        Revenue: {formatCurrency(client.monthly_revenue)} • 
                        NOTs: {client.nots_generated.toFixed(2)}
                      </p>
                    </div>
                    {isAdmin && (
                      <ClientAgentLinkForm 
                        client={client} 
                        onSuccess={() => {
                          handleViewAgentClients(selectedAgent!);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No clients assigned to this agent</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}