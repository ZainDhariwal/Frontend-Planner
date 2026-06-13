"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { 
  BookOpen, 
  HelpCircle, 
  AlertCircle, 
  ArrowLeft, 
  Sun, 
  Moon, 
  Globe, 
  Layers, 
  Calendar,
  CheckCircle,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/atoms/Spinner";
import PlanTreeView from "@/components/organisms/PlanTreeView";
import NodeEditor from "@/components/organisms/NodeEditor";
import CoherencePanel from "@/components/organisms/CoherencePanel";
import ExportDropdown from "@/components/molecules/ExportDropdown";
import VisualCanvas from "@/components/canvas/VisualCanvas";

export default function SharedPlanPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [plan, setPlan] = useState<any | null>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [activeNode, setActiveNode] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "canvas">("tree");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const supabase = createClient();

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

  // Fetch plan details
  useEffect(() => {
    if (!id) return;

    const fetchSharedPlan = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch plan
        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("*")
          .eq("id", id)
          .single();

        if (planError || !planData) {
          throw new Error("This plan is private or does not exist.");
        }

        setPlan(planData);

        // Fetch nodes
        const { data: nodeData, error: nodeError } = await supabase
          .from("plan_nodes")
          .select("*")
          .eq("plan_id", id)
          .order("created_at", { ascending: true });

        if (nodeError) throw nodeError;
        setNodes(nodeData || []);

        // Fetch dependencies
        const { data: depData, error: depError } = await supabase
          .from("plan_node_dependencies")
          .select("*")
          .eq("plan_id", id);

        if (depError) throw depError;
        setDependencies(depData || []);

      } catch (err: any) {
        console.error("Error loading shared plan:", err);
        setError(err.message || "Failed to load the plan workspace.");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedPlan();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading shared architecture plan...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 text-center">
        <div className="h-16 w-16 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-6 shadow-xl shadow-destructive/5 animate-bounce">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
          {error || "This plan is either private, has been deleted, or hasn't been shared publicly by the owner."}
        </p>
        <Button 
          onClick={() => router.push("/")}
          className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to Homepage
        </Button>
      </div>
    );
  }

  // Count metrics
  const pageNodes = nodes.filter(n => n.type === "page");
  const componentNodes = nodes.filter(n => n.type === "component");
  const helperNodes = nodes.filter(n => n.type !== "page" && n.type !== "component");
  const activePageNode = activeNode?.type === "page"
    ? activeNode
    : (activeNode?.parent_id ? nodes.find(n => n.id === activeNode.parent_id && n.type === "page") : null)
    || nodes.find(n => n.type === "page");

  return (
    <div className="flex flex-col bg-background text-foreground min-h-screen transition-colors duration-200">
      {/* Top Glassmorphic Navigation Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push("/")}
              variant="ghost"
              className="h-9 w-9 p-0 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Go to Homepage"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 text-base">
                Frontend Planner
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Read-Only Link
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              onClick={handleToggleTheme}
              className="h-9 w-9 p-0 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4.5 w-4.5" />
              ) : (
                <Moon className="h-4.5 w-4.5" />
              )}
            </Button>

            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 bg-muted/50 border border-border px-3 py-1.5 rounded-xl">
              <BookOpen className="h-3.5 w-3.5" />
              Framework: <strong className="text-foreground capitalize">{plan.settings?.framework || "nextjs"}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Top Banner Notice */}
      <div className="bg-blue-500/5 border-b border-blue-500/10 py-2.5 px-6 text-center text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center gap-2">
        <Globe className="h-3.5 w-3.5" />
        You are viewing a public shared link of this architecture plan. All editing features are disabled.
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-101px)]">
        {/* Left Side: Plan Tree View / Visual Canvas */}
        <main className={`flex-1 bg-background flex flex-col border-r border-border ${viewMode === "tree" ? "p-6 overflow-y-auto" : "p-0 overflow-hidden"}`}>
          <div className="flex-1 flex flex-col justify-start min-h-0">
            {/* Header section (only adds padding if in canvas mode, otherwise relies on parent p-6) */}
            <div className={`space-y-4 shrink-0 border-b border-border pb-4 ${viewMode === "canvas" ? "p-6" : "mb-6"}`}>
              {/* Plan Info Card */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">{plan.title}</h2>
                  <p className="text-muted-foreground text-xs leading-normal max-w-2xl">
                    {plan.settings?.briefSummary || plan.brief}
                  </p>
                </div>
                <div className="shrink-0">
                  <ExportDropdown plan={plan} nodes={nodes} dependencies={dependencies} />
                </div>
              </div>

              {/* View Selector Tabs & Dropdown */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("tree")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "tree"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Tree View
                  </button>
                  <button
                    onClick={() => setViewMode("canvas")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "canvas"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Visual Canvas
                  </button>
                </div>

                {viewMode === "canvas" && pageNodes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-semibold">Active Page:</span>
                    <select
                      value={activePageNode?.id || ""}
                      onChange={(e) => {
                        const selected = pageNodes.find(p => p.id === e.target.value);
                        if (selected) setActiveNode(selected);
                      }}
                      className="border border-border bg-background rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer font-semibold text-foreground"
                    >
                      {pageNodes.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.metadata?.path || "/"})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Content area */}
            {viewMode === "tree" ? (
              <PlanTreeView
                planId={plan.id}
                nodes={nodes}
                activeNodeId={activeNode?.id || null}
                onSelectNode={setActiveNode}
                readOnly={true}
              />
            ) : activePageNode ? (
              <VisualCanvas
                plan={plan}
                pageNode={activePageNode}
                nodes={nodes}
                onSelectNode={setActiveNode}
                selectedNodeId={activeNode?.id || null}
                onRefreshWorkspace={() => {}}
                readOnly={true}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center gap-4 py-24">
                <div className="h-12 w-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">No Page Routes Found</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    This shared workspace plan does not have any generated page routes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Side: Component Inspector / Workspace Overview Panel */}
        <aside className="w-96 bg-card/30 backdrop-blur-md shrink-0 flex flex-col overflow-y-auto">
          {activeNode ? (
            <NodeEditor
              node={activeNode}
              planId={plan.id}
              framework={plan.settings?.framework || "nextjs"}
              readOnly={true}
              onNodeUpdated={() => {}}
              onClose={() => setActiveNode(null)}
            />
          ) : (
            <div className="p-6 space-y-6">
              {/* Architecture Statistics Overview */}
              <div>
                <h3 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Layers className="h-4 w-4 text-blue-500" />
                  Workspace Summary
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card/50 border border-border p-3 rounded-xl text-center">
                    <div className="text-lg font-extrabold text-foreground">{pageNodes.length}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Pages</div>
                  </div>
                  <div className="bg-card/50 border border-border p-3 rounded-xl text-center">
                    <div className="text-lg font-extrabold text-foreground">{componentNodes.length}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Components</div>
                  </div>
                  <div className="bg-card/50 border border-border p-3 rounded-xl text-center">
                    <div className="text-lg font-extrabold text-foreground">{helperNodes.length}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Helpers</div>
                  </div>
                </div>
              </div>

              {/* Product Brief Description Box */}
              <div className="border border-border bg-card/40 p-4.5 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">Product Brief</h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {plan.brief}
                </p>
              </div>

              {/* Coherence Check */}
              <CoherencePanel nodes={nodes} dependencies={dependencies} />

              {/* Collaboration Banner */}
              <div className="border border-dashed border-border bg-muted/10 p-4 rounded-xl text-center space-y-2">
                <div className="text-xs font-bold text-foreground">Want to implement this project?</div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Use the Export button above to download a complete boilerplate ZIP archive, or copy the master AI generation prompt to scaffold this application in Cursor, Lovable, or v0.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
