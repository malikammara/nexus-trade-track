import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Search,
  AlertTriangle,
  CheckCircle,
  Award,
  TrendingUp,
  Calendar,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import { AgentEvaluation, EvaluationAlert } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useAgents } from "@/hooks/useAgents";
import { EvaluationForm } from "@/components/EvaluationForm";
import { format, startOfWeek } from "date-fns";
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

export default function Evaluations() {
  const { toast } = useToast();
  const { evaluations, alerts, loading, error, isManager, addEvaluation, updateEvaluation, deleteEvaluation } = useEvaluations();
  const { agents } = useAgents();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState<AgentEvaluation | null>(null);

  const handleAddEvaluation = async (data: any) => {
    try {
      await addEvaluation({
        agent_id: data.agent_id,
        week_start_date: data.week_start_date.toISOString().split('T')[0],
        compliance_score: data.compliance_score,
        tone_clarity_score: data.tone_clarity_score,
        relevance_score: data.relevance_score,
        client_satisfaction_score: data.client_satisfaction_score,
        portfolio_revenue_score: data.portfolio_revenue_score,
        compliance_remarks: data.compliance_remarks,
        tone_remarks: data.tone_remarks,
        relevance_remarks: data.relevance_remarks,
        satisfaction_remarks: data.satisfaction_remarks,
        portfolio_remarks: data.portfolio_remarks,
        overall_remarks: data.overall_remarks,
      });
      toast({
        title: "Evaluation Added",
        description: "Agent evaluation has been recorded successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add evaluation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEvaluation = async (data: any) => {
    if (!selectedEvaluation) return;
    
    try {
      await updateEvaluation(selectedEvaluation.id, {
        compliance_score: data.compliance_score,
        tone_clarity_score: data.tone_clarity_score,
        relevance_score: data.relevance_score,
        client_satisfaction_score: data.client_satisfaction_score,
        portfolio_revenue_score: data.portfolio_revenue_score,
        compliance_remarks: data.compliance_remarks,
        tone_remarks: data.tone_remarks,
        relevance_remarks: data.relevance_remarks,
        satisfaction_remarks: data.satisfaction_remarks,
        portfolio_remarks: data.portfolio_remarks,
        overall_remarks: data.overall_remarks,
      });
      toast({
        title: "Evaluation Updated",
        description: "Agent evaluation has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update evaluation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvaluation = async (evaluation: AgentEvaluation) => {
    try {
      await deleteEvaluation(evaluation.id);
      toast({
        title: "Evaluation Deleted",
        description: "Agent evaluation has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete evaluation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((evaluation) =>
      evaluation.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evaluation.agent_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [evaluations, searchTerm]);

  const getAlertBadge = (score: number) => {
    if (score <= 15) return { variant: "destructive" as const, icon: AlertTriangle, text: "Critical" };
    if (score <= 19) return { variant: "secondary" as const, icon: AlertTriangle, text: "Warning" };
    if (score <= 23) return { variant: "default" as const, icon: CheckCircle, text: "Good" };
    return { variant: "default" as const, icon: Award, text: "Excellent" };
  };

  const criticalAlerts = alerts.filter(a => a.alert_level === 'critical');
  const warningAlerts = alerts.filter(a => a.alert_level === 'warning');
  const excellentPerformers = alerts.filter(a => a.alert_level === 'excellent');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Evaluations</h1>
          <p className="text-muted-foreground">
            Weekly performance evaluations and coaching alerts for CS team agents
          </p>
        </div>
        
        {isManager && (
          <EvaluationForm 
            agents={agents} 
            onSubmit={handleAddEvaluation}
          />
        )}
      </div>

      {/* Alert Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Immediate coaching needed</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{warningAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Additional support required</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Excellent Performers</CardTitle>
            <Award className="h-4 w-4 text-trading-profit" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-profit">{excellentPerformers.length}</div>
            <p className="text-xs text-muted-foreground">Training examples</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluations.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search evaluations by agent name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading evaluations...
        </div>
      )}
      {error && (
        <div className="text-destructive text-sm">Failed to load evaluations. Please refresh.</div>
      )}

      {/* Evaluations List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEvaluations.map((evaluation) => {
          const alertBadge = getAlertBadge(evaluation.total_score);
          const AlertIcon = alertBadge.icon;
          
          return (
            <Card 
              key={evaluation.id} 
              className={cn(
                "shadow-card hover:shadow-elegant transition-shadow",
                evaluation.total_score <= 15 && "border-destructive bg-destructive/5",
                evaluation.total_score >= 24 && "border-trading-profit bg-trading-profit/5"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{evaluation.agent_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{evaluation.agent_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Week of {format(new Date(evaluation.week_start_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alertBadge.variant} className="flex items-center gap-1">
                      <AlertIcon className="h-3 w-3" />
                      {alertBadge.text}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{evaluation.total_score}</div>
                  <div className="text-sm text-muted-foreground">out of 25</div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compliance:</span>
                    <span className="font-medium">{evaluation.compliance_score}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tone & Clarity:</span>
                    <span className="font-medium">{evaluation.tone_clarity_score}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Relevance:</span>
                    <span className="font-medium">{evaluation.relevance_score}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client Satisfaction:</span>
                    <span className="font-medium">{evaluation.client_satisfaction_score}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Portfolio Impact:</span>
                    <span className="font-medium">{evaluation.portfolio_revenue_score}/5</span>
                  </div>
                </div>

                {evaluation.overall_remarks && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      <strong>Remarks:</strong> {evaluation.overall_remarks}
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-border flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedEvaluation(evaluation)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                  
                  {isManager && (
                    <>
                      <EvaluationForm
                        agents={agents}
                        onSubmit={handleUpdateEvaluation}
                        evaluation={evaluation}
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
                            <AlertDialogTitle>Delete Evaluation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this evaluation for {evaluation.agent_name}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteEvaluation(evaluation)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredEvaluations.length === 0 && !loading && (
        <Card className="shadow-card">
          <CardContent className="text-center py-8">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No evaluations found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search" : "Add your first evaluation to get started"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Details Dialog */}
      <Dialog open={!!selectedEvaluation} onOpenChange={() => setSelectedEvaluation(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Evaluation Details - {selectedEvaluation?.agent_name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Week of {selectedEvaluation && format(new Date(selectedEvaluation.week_start_date), "MMM dd, yyyy")}
            </p>
          </DialogHeader>

          {selectedEvaluation && (
            <div className="space-y-6">
              {/* Score Summary */}
              <div className="text-center p-4 bg-accent rounded-lg">
                <div className="text-4xl font-bold mb-2">{selectedEvaluation.total_score}</div>
                <div className="text-sm text-muted-foreground mb-2">out of 25</div>
                <Badge variant={getAlertBadge(selectedEvaluation.total_score).variant}>
                  {selectedEvaluation.performance_level}
                </Badge>
              </div>

              {/* Detailed Scores */}
              <div className="space-y-4">
                <h4 className="font-medium">Detailed Scores</h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Compliance</p>
                      <p className="text-sm text-muted-foreground">
                        Calls via company lines, SOP followed, privacy ensured
                      </p>
                      {selectedEvaluation.compliance_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.compliance_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{selectedEvaluation.compliance_score}/5</Badge>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Tone & Clarity</p>
                      <p className="text-sm text-muted-foreground">
                        Professional, polite, confident, clear communication
                      </p>
                      {selectedEvaluation.tone_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.tone_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{selectedEvaluation.tone_clarity_score}/5</Badge>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Relevance</p>
                      <p className="text-sm text-muted-foreground">
                        Advice matches client needs, correct product use
                      </p>
                      {selectedEvaluation.relevance_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.relevance_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{selectedEvaluation.relevance_score}/5</Badge>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Client Satisfaction</p>
                      <p className="text-sm text-muted-foreground">
                        Queries resolved, value delivered, client supported
                      </p>
                      {selectedEvaluation.satisfaction_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.satisfaction_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{selectedEvaluation.client_satisfaction_score}/5</Badge>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Portfolio & Revenue Impact</p>
                      <p className="text-sm text-muted-foreground">
                        Equity trends, NOTs achieved, retention efforts
                      </p>
                      {selectedEvaluation.portfolio_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.portfolio_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{selectedEvaluation.portfolio_revenue_score}/5</Badge>
                  </div>
                </div>
              </div>

              {/* Overall Remarks */}
              {selectedEvaluation.overall_remarks && (
                <div className="space-y-2">
                  <h4 className="font-medium">Overall Remarks</h4>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">{selectedEvaluation.overall_remarks}</p>
                  </div>
                </div>
              )}

              {/* Evaluation Info */}
              <div className="pt-4 border-t border-border text-xs text-muted-foreground">
                <p>Evaluated by: {selectedEvaluation.evaluated_by}</p>
                <p>Date: {format(new Date(selectedEvaluation.created_at), "PPP 'at' p")}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}