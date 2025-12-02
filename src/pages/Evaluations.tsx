import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Search,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Award,
  TrendingUp,
  Loader as Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import type { AgentEvaluation } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useAgents } from "@/hooks/useAgents";
import { EvaluationForm } from "@/components/EvaluationForm";
import { format } from "date-fns";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { evaluationPoints } from "@/constants/evaluationPoints";

// tiny cn
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// date → "YYYY-MM-DD"
const toYMD = (d: Date | string) => {
  if (!d) return null;
  if (typeof d === "string") return d.includes("T") ? d.split("T")[0] : d;
  return new Date(d).toISOString().split("T")[0];
};

export default function Evaluations() {
  const { toast } = useToast();
  const {
    evaluations,
    alerts,
    loading,
    error,
    canManage,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
  } = useEvaluations();
  const { agents } = useAgents();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState<AgentEvaluation | null>(null);

  const maxScore = evaluationPoints.length * 5;

  // ADD: expects mapped payload from EvaluationForm (criteria_scores + criteria_remarks)
  const handleAddEvaluation = async (data: any) => {
    try {
      const payload = {
        agent_id: data.agent_id,
        week_start_date: toYMD(data.week_start_date)!,
        criteria_scores: data.criteria_scores,
        criteria_remarks: data.criteria_remarks,
        overall_remarks: data.overall_remarks,
      };

      console.log("ADD payload →", payload);
      await addEvaluation(payload);

      toast({ title: "Evaluation Added", description: "Agent evaluation has been recorded successfully." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to add evaluation.",
        variant: "destructive",
      });
    }
  };

  // EDIT
  const handleUpdateEvaluation = async (id: string, data: any) => {
    try {
      const payload = {
        criteria_scores: data.criteria_scores,
        criteria_remarks: data.criteria_remarks,
        overall_remarks: data.overall_remarks,
      };

      console.log("UPDATE payload →", { id, ...payload });
      await updateEvaluation(id, payload);

      toast({ title: "Evaluation Updated", description: "Agent evaluation has been updated successfully." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update evaluation.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvaluation = async (evaluation: AgentEvaluation) => {
    try {
      await deleteEvaluation(evaluation.id);
      toast({ title: "Evaluation Deleted", description: "Agent evaluation has been deleted successfully." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to delete evaluation.",
        variant: "destructive",
      });
    }
  };

  const filteredEvaluations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return evaluations.filter(
      (e) => e.agent_name?.toLowerCase().includes(q) || e.agent_email?.toLowerCase().includes(q)
    );
  }, [evaluations, searchTerm]);

  // thresholds for /maxScore
  const getAlertBadge = (score: number) => {
    if (score <= maxScore * 0.6) return { variant: "destructive" as const, icon: AlertTriangle, text: "Critical" };
    if (score <= maxScore * 0.75) return { variant: "secondary" as const, icon: AlertTriangle, text: "Warning" };
    if (score <= maxScore * 0.9) return { variant: "default" as const, icon: CheckCircle, text: "Good" };
    return { variant: "default" as const, icon: Award, text: "Excellent" };
  };

  const criticalAlerts = alerts.filter((a) => a.alert_level === "critical");
  const warningAlerts = alerts.filter((a) => a.alert_level === "warning");
  const excellentPerformers = alerts.filter((a) => a.alert_level === "excellent");

  // Precompute items grouped by category
  const itemsByCategory = useMemo(() => {
    return evaluationPoints.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof evaluationPoints>);
  }, []);

  const computeCategoryAverages = (evaluation: AgentEvaluation) => {
    const scores = (evaluation as any).criteria_scores || {};
    const result: Record<string, number> = {};

    Object.entries(itemsByCategory).forEach(([category, items]) => {
      const sum = items.reduce((acc, item) => acc + (Number(scores[item.id]) || 0), 0);
      const count = items.length || 1;
      result[category] = sum / count;
    });

    return result;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Evaluations</h1>
          <p className="text-muted-foreground">
            Weekly performance evaluations and coaching alerts for the trading desk
          </p>
        </div>

        {canManage && <EvaluationForm agents={agents} onSubmit={handleAddEvaluation} />}
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
      {error && <div className="text-destructive text-sm">Failed to load evaluations. Please refresh.</div>}

      {/* Evaluations List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEvaluations.map((evaluation) => {
          const alertBadge = getAlertBadge(evaluation.total_score);
          const AlertIcon = alertBadge.icon;
          const categoryAverages = computeCategoryAverages(evaluation);

          return (
            <Card
              key={evaluation.id}
              className={cn(
                "shadow-card hover:shadow-elegant transition-shadow",
                evaluation.total_score <= maxScore * 0.6 && "border-destructive bg-destructive/5",
                evaluation.total_score >= maxScore * 0.9 && "border-trading-profit bg-trading-profit/5"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{evaluation.agent_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{evaluation.agent_email}</p>
                    <p className="text-xs text-muted-foreground">
                    Date: {format(new Date(evaluation.week_start_date), "MMM dd, yyyy")}
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
                  <div className="text-sm text-muted-foreground">out of {maxScore}</div>
                </div>

                {/* Category averages */}
                <div className="space-y-2 text-sm">
                  {Object.entries(categoryAverages).map(([category, avg]) => (
                    <div className="flex justify-between" key={category}>
                      <span className="text-muted-foreground">{category}:</span>
                      <span className="font-medium">{avg.toFixed(1)}/5</span>
                    </div>
                  ))}
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

                  {canManage && (
                    <>
                      <EvaluationForm
                        agents={agents}
                        onSubmit={(formData) => handleUpdateEvaluation(evaluation.id, formData)}
                        evaluation={evaluation}
                        isEditing
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" aria-label="Delete evaluation">
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

      {/* Evaluation Points Reference */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Evaluation Points</CardTitle>
          <p className="text-sm text-muted-foreground">Granular criteria used in agent evaluations</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(itemsByCategory).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <h3 className="font-semibold text-foreground">{category}</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
      <Dialog
        open={!!selectedEvaluation}
        onOpenChange={(open) => {
          if (!open) setSelectedEvaluation(null);
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluation Details - {selectedEvaluation?.agent_name}</DialogTitle>
            {selectedEvaluation && (
  <p className="text-sm text-muted-foreground">
    Evaluation Date: {format(new Date(selectedEvaluation.week_start_date), "MMM dd, yyyy")}
  </p>
)}
          </DialogHeader>

          {selectedEvaluation && (
            <div className="space-y-6">
              <div className="text-center p-4 bg-accent rounded-lg">
                <div className="text-4xl font-bold mb-2">{selectedEvaluation.total_score}</div>
                <div className="text-sm text-muted-foreground mb-2">out of {maxScore}</div>
                <Badge variant={getAlertBadge(selectedEvaluation.total_score).variant}>
                  {selectedEvaluation.performance_level}
                </Badge>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Detailed Scores</h4>
                <div className="space-y-3">
                  {evaluationPoints.map((item) => {
                    const scores = (selectedEvaluation as any).criteria_scores || {};
                    const remarks = (selectedEvaluation as any).criteria_remarks || {};
                    const score = scores[item.id];

                    if (typeof score !== "number") return null;

                    return (
                      <div className="flex justify-between items-start" key={item.id}>
                        <div>
                          <p className="font-medium">
                            {item.label}
                            <span className="ml-2 text-xs text-muted-foreground">({item.category})</span>
                          </p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                          {remarks[item.id] && (
                            <p className="text-sm text-blue-600 mt-1">
                              <strong>Remarks:</strong> {remarks[item.id]}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">{score}/5</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {selectedEvaluation.overall_remarks && (
                  <>
                    <h4 className="font-medium">Overall Remarks</h4>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{selectedEvaluation.overall_remarks}</p>
                    </div>
                  </>
                )}
              </div>

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
