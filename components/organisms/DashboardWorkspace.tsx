"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { 
  Plus, 
  BookOpen, 
  Settings, 
  Sparkles, 
  HelpCircle, 
  Calendar,
  AlertCircle,
  FolderOpen,
  ChevronRight,
  Undo2,
  Redo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "./Navbar";
import SettingsModal from "./SettingsModal";
import PlanTreeView from "./PlanTreeView";
import NodeEditor from "./NodeEditor";
import CoherencePanel from "./CoherencePanel";
import ExportDropdown from "../molecules/ExportDropdown";
import ShareButton from "../molecules/ShareButton";
import CostDashboardModal from "./CostDashboardModal";
import { CostIndicator } from "../molecules/CostIndicator";
import { Spinner } from "@/components/atoms/Spinner";

interface DashboardWorkspaceProps {
  user: User;
}

export default function DashboardWorkspace({ user }: DashboardWorkspaceProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  
  // Selection states
  const [activeNode, setActiveNode] = useState<any | null>(null);
  
  // UI states
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [decomposingMap, setDecomposingMap] = useState<Record<string, boolean>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCostDashboardOpen, setIsCostDashboardOpen] = useState(false);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [redecomposeNode, setRedecomposeNode] = useState<any | null>(null);
  const [customDecomposeInstruction, setCustomDecomposeInstruction] = useState("");
  const [quotaFallback, setQuotaFallback] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  
  // History states
  const [undoStack, setUndoStack] = useState<Array<{ nodes: any[]; dependencies: any[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ nodes: any[]; dependencies: any[] }>>([]);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newBrief, setNewBrief] = useState("");
  const [newFramework, setNewFramework] = useState("nextjs");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const supabase = createClient();

  // 1. Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Theme synchronization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const syncStateToDatabase = async (targetNodes: any[], targetDependencies: any[]) => {
    if (!activePlan) return;
    try {
      // Fetch DB current state
      const { data: dbNodes } = await supabase.from("plan_nodes").select("id").eq("plan_id", activePlan.id);
      const { data: dbDeps } = await supabase.from("plan_node_dependencies").select("id").eq("plan_id", activePlan.id);

      const dbNodeIds = new Set((dbNodes || []).map((n: any) => n.id));
      const targetNodeIds = new Set(targetNodes.map((n: any) => n.id));

      const dbDepIds = new Set((dbDeps || []).map((d: any) => d.id));
      const targetDepIds = new Set(targetDependencies.map((d: any) => d.id));

      // Items to delete
      const nodesToDelete = (dbNodes || []).filter((n: any) => !targetNodeIds.has(n.id)).map((n: any) => n.id);
      const depsToDelete = (dbDeps || []).filter((d: any) => !targetDepIds.has(d.id)).map((d: any) => d.id);

      if (depsToDelete.length > 0) {
        await supabase.from("plan_node_dependencies").delete().in("id", depsToDelete);
      }
      if (nodesToDelete.length > 0) {
        await supabase.from("plan_nodes").delete().in("id", nodesToDelete);
      }

      // Upsert current state
      if (targetNodes.length > 0) {
        const cleanNodes = targetNodes.map(n => ({
          id: n.id,
          plan_id: n.plan_id,
          parent_id: n.parent_id,
          type: n.type,
          name: n.name,
          description: n.description,
          status: n.status,
          metadata: n.metadata,
          version: n.version,
          created_at: n.created_at,
          updated_at: n.updated_at
        }));
        const { error: nodeError } = await supabase.from("plan_nodes").upsert(cleanNodes);
        if (nodeError) throw nodeError;
      }

      if (targetDependencies.length > 0) {
        const cleanDeps = targetDependencies.map(d => ({
          id: d.id,
          plan_id: d.plan_id,
          source_node_id: d.source_node_id,
          target_node_id: d.target_node_id,
          dependency_type: d.dependency_type,
          created_at: d.created_at
        }));
        const { error: depError } = await supabase.from("plan_node_dependencies").upsert(cleanDeps);
        if (depError) throw depError;
      }
    } catch (err) {
      console.error("Error syncing database on history change:", err);
    }
  };

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSyncRef = useRef<{ nodes: any[]; dependencies: any[] } | null>(null);

  // Clean up sync timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const queueDatabaseSync = (targetNodes: any[], targetDependencies: any[]) => {
    pendingSyncRef.current = { nodes: targetNodes, dependencies: targetDependencies };
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(async () => {
      if (pendingSyncRef.current) {
        const { nodes: ns, dependencies: deps } = pendingSyncRef.current;
        pendingSyncRef.current = null;
        await syncStateToDatabase(ns, deps);
      }
    }, 600);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { nodes: [...nodes], dependencies: [...dependencies] }]);
    setUndoStack(newUndoStack);

    // Stop any active decomposing spinner/process immediately
    setDecomposingMap({});

    setNodes(previousState.nodes);
    setDependencies(previousState.dependencies);

    queueDatabaseSync(previousState.nodes, previousState.dependencies);

    if (activeNode && !previousState.nodes.some((n: any) => n.id === activeNode.id)) {
      setActiveNode(null);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, { nodes: [...nodes], dependencies: [...dependencies] }]);
    setRedoStack(newRedoStack);

    // Stop any active decomposing spinner/process immediately
    setDecomposingMap({});

    setNodes(nextState.nodes);
    setDependencies(nextState.dependencies);

    queueDatabaseSync(nextState.nodes, nextState.dependencies);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack, redoStack, nodes, dependencies, activeNode, activePlan]);

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlans(data || []);
      
      // Auto-select first plan if available
      if (data && data.length > 0 && !activePlan) {
        handleSelectPlan(data[0]);
      }
    } catch (err) {
      console.error("Error loading plans:", err);
    } finally {
      setLoadingPlans(false);
    }
  };

  // 2. Fetch nodes and dependencies for active plan
  const handleSelectPlan = async (plan: any) => {
    setActivePlan(plan);
    setActiveNode(null);
    setUndoStack([]);
    setRedoStack([]);
    try {
      setLoadingDetails(true);
      
      // Fetch nodes
      const { data: nodeData, error: nodeError } = await supabase
        .from("plan_nodes")
        .select("*")
        .eq("plan_id", plan.id)
        .order("created_at", { ascending: true });

      if (nodeError) throw nodeError;

      // Fetch dependencies
      const { data: depData, error: depError } = await supabase
        .from("plan_node_dependencies")
        .select("*")
        .eq("plan_id", plan.id);

      if (depError) throw depError;

      setNodes(nodeData || []);
      setDependencies(depData || []);
    } catch (err) {
      console.error("Error loading plan details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // 3. Create a new plan via generate endpoint
  const handleCreatePlan = async (e: React.FormEvent, skipCustomKey: boolean = false) => {
    if (e) e.preventDefault();
    if (!newTitle.trim() || !newBrief.trim()) {
      alert("Please enter a title and product brief.");
      return;
    }

    let isRetrying = false;
    try {
      setCreatingPlan(true);
      
      // Get settings from local storage
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = skipCustomKey 
        ? null 
        : (provider === "gemini" 
          ? localStorage.getItem("gemini_api_key") 
          : localStorage.getItem("anthropic_api_key"));

      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customKey ? { "x-api-key": customKey } : {})
        },
        body: JSON.stringify({
          brief: newBrief,
          framework: newFramework,
          settings: { title: newTitle },
          provider
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to generate plan");
      }

      // Refresh list and select new plan
      setNewTitle("");
      setNewBrief("");
      setShowNewPlanForm(false);
      
      // Refresh plans list
      const { data: updatedPlans } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false });
      
      setPlans(updatedPlans || []);
      
      if (result.plan) {
        setActivePlan(result.plan);
        setNodes(result.nodes || []);
        setDependencies([]);
      }
    } catch (err: any) {
      console.error("Failed to generate plan:", err);

      const errorMsg = err.message || "";
      const isQuota = errorMsg.toLowerCase().includes("quota") || 
                      errorMsg.toLowerCase().includes("limit") || 
                      errorMsg.toLowerCase().includes("rate limit") ||
                      errorMsg.toLowerCase().includes("429");
      
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = provider === "gemini" 
        ? localStorage.getItem("gemini_api_key") 
        : localStorage.getItem("anthropic_api_key");

      if (isQuota && customKey && !skipCustomKey) {
        isRetrying = true;
        setQuotaFallback({
          title: "API Key Quota Exceeded",
          description: "Your custom API key has run out of quota limits. Would you like to retry generating this response using the default system API key (free version) instead?",
          onConfirm: () => {
            handleCreatePlan(e, true);
          }
        });
        return;
      }

      alert(`Plan generation failed: ${err.message}`);
    } finally {
      if (!isRetrying) {
        setCreatingPlan(false);
      }
    }
  };

  // 4. Decompose a page route node
  const handleDecomposePage = async (pageId: string, customInstruction?: string, skipCustomKey: boolean = false) => {
    // Intercept if already has children to prompt user for specification details
    const hasChildren = nodes.some((n) => n.parent_id === pageId);
    if (hasChildren && customInstruction === undefined && !skipCustomKey) {
      const targetNode = nodes.find((n) => n.id === pageId);
      setRedecomposeNode(targetNode);
      return;
    }

    setUndoStack((prev) => [...prev, { nodes: [...nodes], dependencies: [...dependencies] }]);
    setRedoStack([]);

    setDecomposingMap((prev) => ({ ...prev, [pageId]: true }));
    let isRetrying = false;
    try {
      // Get settings from local storage
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = skipCustomKey 
        ? null 
        : (provider === "gemini" 
          ? localStorage.getItem("gemini_api_key") 
          : localStorage.getItem("anthropic_api_key"));

      const targetNode = nodes.find((n) => n.id === pageId);
      const nodeName = targetNode?.name || "";
      const nodePath = targetNode?.metadata?.path || "";
      const nodeDescription = targetNode?.description || "";
      const framework = activePlan?.settings?.framework || "nextjs";

      const response = await fetch("/api/plans/decompose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customKey ? { "x-api-key": customKey } : {})
        },
        body: JSON.stringify({
          planId: activePlan.id,
          nodeId: pageId,
          nodeName,
          nodePath,
          nodeDescription,
          framework,
          provider,
          instruction: customInstruction
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Decomposition failed");
      }

      // Reload plan details to fetch all newly decomposed elements
      if (activePlan) {
        await handleSelectPlan(activePlan);
      }
    } catch (err: any) {
      console.error("Decomposition failed:", err);

      const errorMsg = err.message || "";
      const isQuota = errorMsg.toLowerCase().includes("quota") || 
                      errorMsg.toLowerCase().includes("limit") || 
                      errorMsg.toLowerCase().includes("rate limit") ||
                      errorMsg.toLowerCase().includes("429");
      
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = provider === "gemini" 
        ? localStorage.getItem("gemini_api_key") 
        : localStorage.getItem("anthropic_api_key");

      if (isQuota && customKey && !skipCustomKey) {
        isRetrying = true;
        setQuotaFallback({
          title: "API Key Quota Exceeded",
          description: "Your custom API key has run out of quota limits. Would you like to retry decomposing this page using the default system API key (free version) instead?",
          onConfirm: () => {
            handleDecomposePage(pageId, customInstruction, true);
          }
        });
        return;
      }

      alert(`Decomposition failed: ${err.message}`);
    } finally {
      if (!isRetrying) {
        setDecomposingMap((prev) => ({ ...prev, [pageId]: false }));
      }
    }
  };

  // 5. Handle node updates (called from NodeEditor)
  const handleNodeUpdated = (updatedNode: any) => {
    setUndoStack((prev) => [...prev, { nodes: [...nodes], dependencies: [...dependencies] }]);
    setRedoStack([]);

    // Update local nodes list
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    
    // Update activeNode if it's currently selected
    if (activeNode && activeNode.id === updatedNode.id) {
      setActiveNode(updatedNode);
    }

    // Refresh active plan cost / details
    if (activePlan) {
      supabase.from("plans").select("*").eq("id", activePlan.id).single().then(({ data }) => {
        if (data) {
          setActivePlan(data);
          // Refetch dependencies because they might have been updated
          supabase.from("plan_node_dependencies").select("*").eq("plan_id", activePlan.id).then(({ data: deps }) => {
            if (deps) setDependencies(deps);
          });
        }
      });
    }
  };

  const handleSignOut = async () => {
    try {
      setSignOutLoading(true);
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error("Sign-out error:", err);
      setSignOutLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen transition-colors duration-200">
      {/* Navbar Header */}
      <Navbar 
        user={user} 
        onSignOut={handleSignOut} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCostDashboard={() => setIsCostDashboardOpen(true)}
        signOutLoading={signOutLoading}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Workspace Panels */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-69px)] bg-background">
        {/* Left Panel: Plan Sidebar */}
        <aside className="w-80 border-r border-border bg-card/30 backdrop-blur-md p-4 flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Saved Projects</span>
            <button
              onClick={() => setShowNewPlanForm(!showNewPlanForm)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-border text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              title="New plan"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* New Plan Scaffolding Form Drawer */}
          {showNewPlanForm && (
            <form onSubmit={handleCreatePlan} className="border border-border bg-card/60 p-4 rounded-xl space-y-3 animate-in slide-in-from-top duration-200 shadow-sm">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Project Title</label>
                <input
                  type="text"
                  placeholder="e.g. Developer Portfolio"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:focus:border-zinc-700 text-zinc-800 dark:text-zinc-100 transition-colors"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Product Brief</label>
                <textarea
                  placeholder="Describe the application features and requirements..."
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  rows={4}
                  className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:focus:border-zinc-700 text-zinc-800 dark:text-zinc-100 transition-colors resize-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Target Framework</label>
                <select
                  value={newFramework}
                  onChange={(e) => setNewFramework(e.target.value)}
                  className="w-full border border-border bg-background rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer"
                >
                  <option value="nextjs">Next.js (App Router)</option>
                  <option value="react">React (SPA Boilerplate)</option>
                  <option value="vue">Vue (Nuxt / Atomic)</option>
                  <option value="svelte">Svelte (SvelteKit / Atomic)</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={creatingPlan}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-8 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-blue-500/10"
              >
                {creatingPlan ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-zinc-200 border-t-transparent rounded-full animate-spin" />
                    Generating Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Create Architecture
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Plan Navigation List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingPlans ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600 dark:text-zinc-400 gap-2">
                <Spinner size="sm" />
                <span className="text-xs">Loading plans...</span>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl text-zinc-600 dark:text-zinc-400 text-xs">
                No plans generated yet. Click + to start.
              </div>
            ) : (
              plans.map((p) => {
                const isActive = activePlan?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPlan(p)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-500/5 border-blue-500/30 shadow-lg"
                        : "bg-card/40 border-border hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-muted/40"
                    }`}
                  >
                    <div className={`font-bold text-sm truncate ${isActive ? "text-blue-500 dark:text-blue-400" : "text-zinc-800 dark:text-zinc-100"}`}>
                      {p.title}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold truncate mt-1">{p.brief}</p>
                    
                    <div className="flex items-center justify-between mt-2.5 border-t border-border pt-2 text-[11px] text-zinc-600 dark:text-zinc-400 font-bold">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {p.settings?.framework === "nextjs" 
                          ? "Next.js" 
                          : p.settings?.framework === "react" 
                          ? "React" 
                          : p.settings?.framework === "vue" 
                          ? "Vue" 
                          : p.settings?.framework === "svelte" 
                          ? "Svelte" 
                          : "Custom"}
                      </span>
                      <span>
                        {Number(p.total_cost || 0) === 0 
                          ? "$0.00" 
                          : Number(p.total_cost || 0) < 0.01 
                          ? `$${Number(p.total_cost || 0).toFixed(6)}` 
                          : `$${Number(p.total_cost || 0).toFixed(4)}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Middle Panel: Active Plan Tree Workspace */}
        <main className="flex-1 bg-background p-6 overflow-y-auto flex flex-col">
          {activePlan ? (
            <div className="space-y-6 flex-1 flex flex-col justify-start">
              {/* Plan Information Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">{activePlan.title}</h2>
                  <p className="text-muted-foreground text-xs mt-1 leading-normal max-w-xl">
                    {activePlan.settings?.briefSummary || activePlan.brief}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Undo / Redo Toolbar */}
                  <div className="flex items-center gap-1 bg-muted/40 border border-border p-1 rounded-lg">
                    <Button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-md disabled:opacity-40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Undo (Cmd+Z)"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-md disabled:opacity-40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Redo (Cmd+Y)"
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <CostIndicator cost={Number(activePlan.total_cost || 0)} />
                  <ShareButton plan={activePlan} onPlanUpdated={(updatedPlan) => {
                    setActivePlan(updatedPlan);
                    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
                  }} />
                  <ExportDropdown plan={activePlan} nodes={nodes} dependencies={dependencies} />
                </div>
              </div>

              {/* Drilldown Trees container */}
              {loadingDetails ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 py-24">
                  <Spinner size="md" />
                  <span className="text-xs font-medium">Loading page nodes...</span>
                </div>
              ) : (
                <PlanTreeView
                  planId={activePlan.id}
                  nodes={nodes}
                  activeNodeId={activeNode?.id || null}
                  onSelectNode={setActiveNode}
                  onDecomposePage={handleDecomposePage}
                  decomposingMap={decomposingMap}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center gap-4 py-24">
              <div className="h-12 w-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Select or Create a Plan</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Create a new architecture plan or select a plan from the left panel to display the page route nodes.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel: Node Editor Inspector OR Coherence Panel */}
        <aside className="w-80 border-l border-border bg-card/30 backdrop-blur-md shrink-0 flex flex-col">
          {activePlan ? (
            activeNode ? (
              <NodeEditor
                node={activeNode}
                planId={activePlan.id}
                framework={activePlan.settings?.framework || "nextjs"}
                readOnly={false}
                onNodeUpdated={handleNodeUpdated}
                onClose={() => setActiveNode(null)}
              />
            ) : (
              <div className="p-4 overflow-y-auto">
                <CoherencePanel nodes={nodes} dependencies={dependencies} />
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 text-center text-xs text-zinc-400 dark:text-zinc-600 font-medium">
              No plan selected
            </div>
          )}
        </aside>
      </div>

      {/* Global Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSettingsChanged={() => {
          // Re-fetch plans to refresh cost etc., if keys updated
          fetchPlans();
        }}
      />

      {/* Cost & Token Analytics Dashboard Modal */}
      {isCostDashboardOpen && (
        <CostDashboardModal
          onClose={() => setIsCostDashboardOpen(false)}
          plans={plans}
          activePlanId={activePlan?.id || null}
        />
      )}

      {/* Re-decompose Custom Instructions Modal */}
      {redecomposeNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setRedecomposeNode(null)} />
          <div className="relative border border-border bg-card p-6 rounded-2xl w-full max-w-md shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Re-decompose Specifications
            </h3>
            <p className="text-xs text-muted-foreground leading-normal mb-4">
              Enter any custom instructions to guide the AI during this re-decomposition of <strong className="text-foreground">"{redecomposeNode.name}"</strong> (e.g., additional components, specific props, or library details).
            </p>
            <textarea
              placeholder="e.g. Include a LineChart component using recharts. Add a paginated filter custom hook."
              value={customDecomposeInstruction}
              onChange={(e) => setCustomDecomposeInstruction(e.target.value)}
              rows={4}
              className="w-full border border-border bg-background rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-all placeholder:text-muted-foreground/50 resize-none mb-4"
            />
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button 
                onClick={() => setRedecomposeNode(null)} 
                variant="ghost" 
                className="text-muted-foreground hover:text-foreground text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleDecomposePage(redecomposeNode.id, customDecomposeInstruction);
                  setRedecomposeNode(null);
                  setCustomDecomposeInstruction("");
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 px-4 cursor-pointer font-semibold shadow-lg shadow-blue-500/10"
              >
                Trigger Re-decompose
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quota Fallback Modal */}
      {quotaFallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setQuotaFallback(null)} />
          <div className="relative border border-border bg-card p-6 rounded-2xl w-full max-w-md shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg text-amber-500 flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              {quotaFallback.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-normal mb-6">
              {quotaFallback.description}
            </p>
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button 
                onClick={() => setQuotaFallback(null)} 
                variant="ghost" 
                className="text-muted-foreground hover:text-foreground text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const onConfirm = quotaFallback.onConfirm;
                  setQuotaFallback(null);
                  onConfirm();
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 px-4 cursor-pointer font-semibold shadow-lg shadow-blue-500/10"
              >
                Yes, Use Free Version
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
