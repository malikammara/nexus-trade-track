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

/** ---------- STRICT REMARK MAPPERS (page-level) ---------- **/
const isNonEmpty = (v: any): v is string => typeof v === "string" && v.trim().length > 0;
const orNull = (v: any) => (isNonEmpty(v) ? v.trim() : null);
const firstNonEmpty = (...vals: any[]) => vals.find(isNonEmpty) ?? null;

// Pull values from *any* of these keys (flat or nested) and normalize to the 3 canonical fields.
function extractToneRemarks(d: any) {
  return firstNonEmpty(
    d?.tone_remarks,
    d?.toneRemarks,
    d?.tone_clarity_remarks,
    d?.toneClarityRemarks,
    d?.toneClarityNotes,
    d?.tone_notes,
    d?.toneNotes,
    d?.toneAndClarityRemarks,
    d?.tone_and_clarity_remarks,
    d?.remarks?.tone,
    d?.remarks?.tone_clarity,
    d?.remarks?.toneClarity
  );
}
function extractSatisfactionRemarks(d: any) {
  return firstNonEmpty(
    d?.satisfaction_remarks,
    d?.client_satisfaction_remarks,
    d?.clientSatisfactionRemarks,
    d?.clientSatisfactionNotes,
    d?.csatRemarks,
    d?.clientRemarks,
    d?.remarks?.satisfaction,
    d?.remarks?.client_satisfaction,
    d?.remarks?.clientSatisfaction
  );
}
function extractPortfolioRemarks(d: any) {
  return firstNonEmpty(
    d?.portfolio_remarks,
    d?.portfolio_revenue_remarks,
    d?.portfolioRevenueRemarks,
    d?.portfolioNotes,
    d?.portfolioAndRevenueRemarks,
    d?.portfolio_revenue_notes,
    d?.remarks?.portfolio,
    d?.remarks?.portfolio_revenue,
    d?.remarks?.portfolioRevenue
  );
}

// date → "YYYY-MM-DD"
const toYMD = (d: Date | string) => {
  if (!d) return null;
  if (typeof d === "string") return d.includes("T") ? d.split("T")[0] : d;
  return new Date(d).toISOString().split("T")[0];
};
/** -------------------------------------------------------- **/

export default function Evaluations() {
  const { toast } = useToast();
  const { evaluations, alerts, loading, error, canManage, addEvaluation, updateEvaluation, deleteEvaluation } = useEvaluations();
  const { agents } = useAgents();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState<AgentEvaluation | null>(null);

  // ADD with strict remark mapping
  const handleAddEvaluation = async (data: any) => {
    try {
      const tone = orNull(extractToneRemarks(data)) ?? orNull(data?.tone_remarks);
      const sat = orNull(extractSatisfactionRemarks(data)) ?? orNull(data?.satisfaction_remarks);
      const port = orNull(extractPortfolioRemarks(data)) ?? orNull(data?.portfolio_remarks);

      const payload = {
        agent_id: data.agent_id,
        week_start_date: toYMD(data.week_start_date)!,

        // core scores (5)
        compliance_score: Number(data.compliance_score),
        tone_clarity_score: Number(data.tone_clarity_score),
        relevance_score: Number(data.relevance_score),
        client_satisfaction_score: Number(data.client_satisfaction_score),
        portfolio_revenue_score: Number(data.portfolio_revenue_score),

        // new scores (4) → total 9 criteria, /45
        trading_tasks_score: Number(data.trading_tasks_score),
        discipline_compliance_score: Number(data.discipline_compliance_score),
        attitude_conduct_score: Number(data.attitude_conduct_score),
        client_metrics_score: Number(data.client_metrics_score),

        compliance_remarks: orNull(data.compliance_remarks),
        tone_remarks: tone,
        relevance_remarks: orNull(data.relevance_remarks),
        satisfaction_remarks: sat,
        portfolio_remarks: port,
        overall_remarks: orNull(data.overall_remarks),

        // new remarks
        trading_tasks_remarks: orNull(data.trading_tasks_remarks),
        discipline_compliance_remarks: orNull(data.discipline_compliance_remarks),
        attitude_conduct_remarks: orNull(data.attitude_conduct_remarks),
        client_metrics_remarks: orNull(data.client_metrics_remarks),
      };

      console.log("ADD payload →", payload); // verify in console
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

  // EDIT with strict remark mapping (pass id explicitly)
  const handleUpdateEvaluation = async (id: string, data: any) => {
    try {
      const tone = orNull(extractToneRemarks(data)) ?? orNull(data?.tone_remarks);
      const sat = orNull(extractSatisfactionRemarks(data)) ?? orNull(data?.satisfaction_remarks);
      const port = orNull(extractPortfolioRemarks(data)) ?? orNull(data?.portfolio_remarks);

      const payload = {
        // core scores
        compliance_score: data.compliance_score != null ? Number(data.compliance_score) : undefined,
        tone_clarity_score: data.tone_clarity_score != null ? Number(data.tone_clarity_score) : undefined,
        relevance_score: data.relevance_score != null ? Number(data.relevance_score) : undefined,
        client_satisfaction_score: data.client_satisfaction_score != null ? Number(data.client_satisfaction_score) : undefined,
        portfolio_revenue_score: data.portfolio_revenue_score != null ? Number(data.portfolio_revenue_score) : undefined,

        // new scores
        trading_tasks_score: data.trading_tasks_score != null ? Number(data.trading_tasks_score) : undefined,
        discipline_compliance_score: data.discipline_compliance_score != null ? Number(data.discipline_compliance_score) : undefined,
        attitude_conduct_score: data.attitude_conduct_score != null ? Number(data.attitude_conduct_score) : undefined,
        client_metrics_score: data.client_metrics_score != null ? Number(data.client_metrics_score) : undefined,

        compliance_remarks: orNull(data.compliance_remarks),
        tone_remarks: tone,
        relevance_remarks: orNull(data.relevance_remarks),
        satisfaction_remarks: sat,
        portfolio_remarks: port,
        overall_remarks: orNull(data.overall_remarks),

        // new remarks
        trading_tasks_remarks: orNull(data.trading_tasks_remarks),
        discipline_compliance_remarks: orNull(data.discipline_compliance_remarks),
        attitude_conduct_remarks: orNull(data.attitude_conduct_remarks),
        client_metrics_remarks: orNull(data.client_metrics_remarks),
      };

      console.log("UPDATE payload →", { id, ...payload }); // verify in console
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

  // thresholds scaled for /45 (same logic as EvaluationForm)
  const getAlertBadge = (score: number) => {
    if (score <= 27) return { variant: "destructive" as const, icon: AlertTriangle, text: "Critical" };
    if (score <= 34) return { variant: "secondary" as const, icon: AlertTriangle, text: "Warning" };
    if (score <= 41) return { variant: "default" as const, icon: CheckCircle, text: "Good" };
    return { variant: "default" as const, icon: Award, text: "Excellent" };
  };

  const criticalAlerts = alerts.filter((a) => a.alert_level === "critical");
  const warningAlerts = alerts.filter((a) => a.alert_level === "warning");
  const excellentPerformers = alerts.filter((a) => a.alert_level === "excellent");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Evaluations</h1>
          <p className="text-muted-foreground">Weekly performance evaluations and coaching alerts for CS team agents</p>
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

          return (
            <Card
              key={evaluation.id}
              className={cn(
                "shadow-card hover:shadow-elegant transition-shadow",
                evaluation.total_score <= 27 && "border-destructive bg-destructive/5",
                evaluation.total_score >= 42 && "border-trading-profit bg-trading-profit/5"
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
                  <div className="text-sm text-muted-foreground">out of 45</div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compliance:</span>
                    <span className="font-medium">{evaluation.compliance_score}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tone &amp; Clarity:</span>
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

                  {/* new four criteria */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trading Tasks:</span>
                    <span className="font-medium">
                      {evaluation.trading_tasks_score != null ? `${evaluation.trading_tasks_score}/5` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discipline &amp; Compliance:</span>
                    <span className="font-medium">
                      {evaluation.discipline_compliance_score != null ? `${evaluation.discipline_compliance_score}/5` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attitude &amp; Conduct:</span>
                    <span className="font-medium">
                      {evaluation.attitude_conduct_score != null ? `${evaluation.attitude_conduct_score}/5` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client Metrics:</span>
                    <span className="font-medium">
                      {evaluation.client_metrics_score != null ? `${evaluation.client_metrics_score}/5` : "-"}
                    </span>
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

                  {canManage && (
                    <>
                      {/* IMPORTANT: pass id explicitly to update */}
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
          <p className="text-sm text-muted-foreground">Key focus areas considered for agent evaluations</p>
        </CardHeader>
        <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(
            evaluationPoints.reduce((acc, item) => {
              if (!acc[item.category]) acc[item.category] = []
              acc[item.category].push(item)
              return acc
            }, {} as Record<string, typeof evaluationPoints>)
          ).map(([category, items]) => (
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
      <Dialog open={!!selectedEvaluation} onOpenChange={(open) => { if (!open) setSelectedEvaluation(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluation Details - {selectedEvaluation?.agent_name}</DialogTitle>
            {selectedEvaluation && (
              <p className="text-sm text-muted-foreground">
                Week of {format(new Date(selectedEvaluation.week_start_date), "MMM dd, yyyy")}
              </p>
            )}
          </DialogHeader>

          {selectedEvaluation && (
            <div className="space-y-6">
              <div className="text-center p-4 bg-accent rounded-lg">
                <div className="text-4xl font-bold mb-2">{selectedEvaluation.total_score}</div>
                <div className="text-sm text-muted-foreground mb-2">out of 45</div>
                <Badge variant={getAlertBadge(selectedEvaluation.total_score).variant}>
                  {selectedEvaluation.performance_level}
                </Badge>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Detailed Scores</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Compliance</p>
                      <p className="text-sm text-muted-foreground">Calls via company lines, SOP followed, privacy ensured</p>
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
                      <p className="font-medium">Tone &amp; Clarity</p>
                      <p className="text-sm text-muted-foreground">Professional, polite, confident, clear communication</p>
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
                      <p className="text-sm text-muted-foreground">Advice matches client needs, correct product use</p>
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
                      <p className="text-sm text-muted-foreground">Queries resolved, value delivered, client supported</p>
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
                      <p className="font-medium">Portfolio &amp; Revenue Impact</p>
                      <p className="text-sm text-muted-foreground">Equity trends, NOTs achieved, retention efforts</p>
                      {selectedEvaluation.portfolio_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.portfolio_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{selectedEvaluation.portfolio_revenue_score}/5</Badge>
                  </div>

                  {/* A. Trading Tasks */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">A. Trading Tasks</p>
                      <p className="text-sm text-muted-foreground">
                        Daily trade calls, stop-loss accuracy, exposure discipline, NOTs performance.
                      </p>
                      {selectedEvaluation.trading_tasks_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.trading_tasks_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">
                      {selectedEvaluation.trading_tasks_score}/5
                    </Badge>
                  </div>

                  {/* B. Discipline & Compliance */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">B. Discipline &amp; Compliance</p>
                      <p className="text-sm text-muted-foreground">
                        Accurate execution, correct order placement &amp; reporting, PMEX &amp; SOP adherence, clean records.
                      </p>
                      {selectedEvaluation.discipline_compliance_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.discipline_compliance_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">
                      {selectedEvaluation.discipline_compliance_score}/5
                    </Badge>
                  </div>

                  {/* C. Attitude & Professional Conduct */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">C. Attitude &amp; Professional Conduct</p>
                      <p className="text-sm text-muted-foreground">
                        Patience, professionalism, call quality, market updates, pressure handling.
                      </p>
                      {selectedEvaluation.attitude_conduct_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.attitude_conduct_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">
                      {selectedEvaluation.attitude_conduct_score}/5
                    </Badge>
                  </div>

                  {/* D. Client Metrics */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">D. Client Metrics</p>
                      <p className="text-sm text-muted-foreground">
                        Client retention vs 60% target, Margin In vs 30% target, overall client health.
                      </p>
                      {selectedEvaluation.client_metrics_remarks && (
                        <p className="text-sm text-blue-600 mt-1">
                          <strong>Remarks:</strong> {selectedEvaluation.client_metrics_remarks}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">
                      {selectedEvaluation.client_metrics_score}/5
                    </Badge>
                  </div>
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
