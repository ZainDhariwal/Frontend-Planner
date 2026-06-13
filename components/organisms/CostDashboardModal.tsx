import React, { useState, useEffect } from "react";
import { X, Coins, ShieldAlert, Cpu, BarChart3, Database, History, RefreshCw, Sparkles, Filter } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/atoms/Spinner";

interface CostDashboardModalProps {
  onClose: () => void;
  plans: any[];
  activePlanId: string | null;
}

export default function CostDashboardModal({ onClose, plans, activePlanId }: CostDashboardModalProps) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activePlanId || "all");
  const [searchQuery, setSearchQuery] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchLogs();
  }, [selectedPlanId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("llm_usage_logs")
        .select(`
          *,
          plans:plan_id (
            title
          )
        `)
        .order("created_at", { ascending: false });

      if (selectedPlanId !== "all") {
        query = query.eq("plan_id", selectedPlanId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error loading LLM usage logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Compute stats
  const totalCost = logs.reduce((sum, log) => sum + Number(log.cost || 0), 0);
  const totalInputTokens = logs.reduce((sum, log) => sum + (log.input_tokens || 0), 0);
  const totalOutputTokens = logs.reduce((sum, log) => sum + (log.output_tokens || 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  // Breakdown by model
  const modelStats: Record<string, { cost: number; tokens: number; count: number }> = {};
  // Breakdown by key type
  const keyStats: Record<string, { cost: number; count: number }> = {
    custom: { cost: 0, count: 0 },
    system: { cost: 0, count: 0 }
  };
  // Breakdown by action type
  const actionStats: Record<string, { cost: number; count: number }> = {
    generate: { cost: 0, count: 0 },
    decompose: { cost: 0, count: 0 },
    regenerate: { cost: 0, count: 0 }
  };

  logs.forEach(log => {
    const model = log.model_name || "unknown";
    const key = log.key_type === "system" ? "system" : "custom";
    const action = log.action_type || "other";
    const cost = Number(log.cost || 0);
    const tokens = (log.input_tokens || 0) + (log.output_tokens || 0);

    // Model
    if (!modelStats[model]) {
      modelStats[model] = { cost: 0, tokens: 0, count: 0 };
    }
    modelStats[model].cost += cost;
    modelStats[model].tokens += tokens;
    modelStats[model].count += 1;

    // Key Type
    if (keyStats[key]) {
      keyStats[key].cost += cost;
      keyStats[key].count += 1;
    }

    // Action Type
    if (actionStats[action]) {
      actionStats[action].cost += cost;
      actionStats[action].count += 1;
    }
  });

  const filteredLogs = logs.filter(log => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (log.model_name || "").toLowerCase().includes(searchLower) ||
      (log.action_type || "").toLowerCase().includes(searchLower) ||
      (log.plans?.title || "").toLowerCase().includes(searchLower)
    );
  });

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      {/* Dialog container */}
      <div className="relative border border-border bg-card/95 backdrop-blur-xl p-6 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl z-10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Visual LLM Cost & Usage</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Analyze and inspect token consumption and API expenditures</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="flex items-center gap-1.5 border border-border bg-muted/40 px-2.5 py-1 rounded-lg">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-semibold cursor-pointer text-foreground"
              >
                <option value="all">All Plans</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="lg" />
            <span className="text-xs text-muted-foreground font-medium">Fetching usage metrics...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6 scrollbar-thin">
            
            {/* 1. Grid of Big Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border border-border bg-muted/30 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Spent</span>
                <span className="text-2xl font-extrabold tracking-tight text-foreground mt-2">{formatCost(totalCost)}</span>
                <span className="text-[10px] text-muted-foreground mt-1">Accumulated API cost</span>
              </div>
              <div className="border border-border bg-muted/30 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Tokens</span>
                <span className="text-2xl font-extrabold tracking-tight text-foreground mt-2">{totalTokens.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground mt-1">Input + Output tokens</span>
              </div>
              <div className="border border-border bg-muted/30 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Token Efficiency</span>
                <span className="text-2xl font-extrabold tracking-tight text-emerald-500 dark:text-emerald-400 mt-2">
                  {totalTokens > 0 ? `${getPercentage(totalOutputTokens, totalTokens)}%` : "0%"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">Output token ratio</span>
              </div>
              <div className="border border-border bg-muted/30 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Actions</span>
                <span className="text-2xl font-extrabold tracking-tight text-foreground mt-2">{logs.length}</span>
                <span className="text-[10px] text-muted-foreground mt-1">LLM request completions</span>
              </div>
            </div>

            {/* 2. Visual Distribution Bars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Model distribution */}
              <div className="border border-border p-4.5 rounded-xl bg-card space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-purple-500" />
                  Model Pricing Share
                </h3>
                <div className="space-y-3.5">
                  {Object.keys(modelStats).length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center">No model queries detected</div>
                  ) : (
                    Object.entries(modelStats).map(([model, data]) => {
                      const pct = getPercentage(data.cost, totalCost);
                      return (
                        <div key={model} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold capitalize">{model.replace(/-/g, " ")}</span>
                            <span className="text-muted-foreground font-semibold">
                              {formatCost(data.cost)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${pct || 1}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Key Type distribution */}
              <div className="border border-border p-4.5 rounded-xl bg-card space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                  Key Allocation Share
                </h3>
                <div className="space-y-4">
                  {/* Custom Key */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">Custom Paid Key</span>
                      <span className="text-muted-foreground font-semibold">
                        {formatCost(keyStats.custom.cost)} ({getPercentage(keyStats.custom.cost, totalCost)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${getPercentage(keyStats.custom.cost, totalCost)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground text-right">{keyStats.custom.count} queries</div>
                  </div>
                  {/* System Key */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">System Default Key</span>
                      <span className="text-muted-foreground font-semibold">
                        {formatCost(keyStats.system.cost)} ({getPercentage(keyStats.system.cost, totalCost)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${getPercentage(keyStats.system.cost, totalCost)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground text-right">{keyStats.system.count} queries</div>
                  </div>
                </div>
              </div>

              {/* Activity breakdown */}
              <div className="border border-border p-4.5 rounded-xl bg-card space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-orange-500" />
                  Operation Cost
                </h3>
                <div className="space-y-3">
                  {Object.entries(actionStats).map(([action, data]) => {
                    const pct = getPercentage(data.cost, totalCost);
                    return (
                      <div key={action} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold capitalize">
                            {action === "generate" ? "Initial Build" : action === "decompose" ? "Lazy Drilling" : "Regeneration"}
                          </span>
                          <span className="text-muted-foreground font-semibold">{formatCost(data.cost)}</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct || 1}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* 3. Searchable Log history list */}
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/10">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">Log History</span>
                </div>
                <input
                  type="text"
                  placeholder="Search by model, action, or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-border bg-background rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full md:w-64 text-foreground transition-colors"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold uppercase text-[9px] tracking-widest">
                      <th className="p-3">Plan</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Model</th>
                      <th className="p-3">Key Type</th>
                      <th className="p-3 text-right">Tokens (In / Out)</th>
                      <th className="p-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No requests log records found.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border/60 hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-semibold max-w-[150px] truncate">{log.plans?.title || "Unknown Plan"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.action_type === "generate" 
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                                : log.action_type === "decompose"
                                ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            }`}>
                              {log.action_type === "generate" ? "Initial Build" : log.action_type === "decompose" ? "Lazy Decompose" : "Regenerate"}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-muted-foreground text-[10px]">{log.model_name}</td>
                          <td className="p-3 capitalize">
                            <span className={`inline-flex items-center gap-1 font-semibold ${
                              log.key_type === "system" ? "text-emerald-500" : "text-blue-500"
                            }`}>
                              {log.key_type === "system" ? "System Free" : "Custom Paid"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-semibold text-muted-foreground">
                            {log.input_tokens.toLocaleString()} / {log.output_tokens.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-foreground">
                            {formatCost(log.cost)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
