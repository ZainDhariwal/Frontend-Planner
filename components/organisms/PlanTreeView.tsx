import React, { useState } from "react";
import { ChevronRight, ChevronDown, RefreshCw, Layers, Sparkles } from "lucide-react";
import { NodeIcon } from "@/components/atoms/NodeIcon";
import { Badge } from "@/components/atoms/Badge";
import { Spinner } from "@/components/atoms/Spinner";

interface PlanTreeViewProps {
  planId: string;
  nodes: any[];
  activeNodeId: string | null;
  onSelectNode: (node: any) => void;
  onDecomposePage?: (pageId: string) => void;
  decomposingMap?: Record<string, boolean>;
  readOnly?: boolean;
}

export default function PlanTreeView({
  planId,
  nodes,
  activeNodeId,
  onSelectNode,
  onDecomposePage,
  decomposingMap = {},
  readOnly = false
}: PlanTreeViewProps) {
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  const togglePageExpand = (pageId: string) => {
    setExpandedPages((prev) => ({
      ...prev,
      [pageId]: !prev[pageId]
    }));
  };

  const pageNodes = nodes.filter((n) => n.type === "page");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
        <h3 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          Page Route Architecture
        </h3>
        <span className="text-xs text-muted-foreground font-medium">
          {pageNodes.length} Page{pageNodes.length !== 1 && "s"}
        </span>
      </div>

      {pageNodes.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 text-muted-foreground text-sm">
          No pages generated yet.
        </div>
      ) : (
        <div className="space-y-3">
          {pageNodes.map((page) => {
            const isExpanded = expandedPages[page.id];
            const isDecomposing = decomposingMap[page.id];
            
            // Get all child elements belonging to this page
            const children = nodes.filter((n) => n.parent_id === page.id);
            const hasChildren = children.length > 0;

            // Group children by category type
            const groupedChildren = children.reduce((acc, node) => {
              if (!acc[node.type]) acc[node.type] = [];
              acc[node.type].push(node);
              return acc;
            }, {} as Record<string, any[]>);

            const categories = [
              { type: "component", label: "Components" },
              { type: "hook", label: "Hooks" },
              { type: "context", label: "Contexts" },
              { type: "data_shape", label: "Data Shapes" },
              { type: "mock_data", label: "Mock Data" },
              { type: "asset", label: "Assets" },
              { type: "lib", label: "Third Party Libraries" }
            ];

            return (
              <div 
                key={page.id} 
                className="border border-border bg-card/60 rounded-xl overflow-hidden shadow-sm transition-all duration-200"
              >
                {/* Page Node Header */}
                <div 
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors duration-150 ${
                    activeNodeId === page.id 
                      ? "bg-blue-500/5 dark:bg-blue-500/10 border-l-2 border-l-blue-500" 
                      : "hover:bg-muted/40"
                  }`}
                  onClick={(e) => {
                    onSelectNode(page);
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) togglePageExpand(page.id);
                      }}
                      className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
                      disabled={!hasChildren}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    <NodeIcon type="page" size={16} />
                    
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {page.name}
                        {page.status && page.status !== "draft" && (
                          <Badge status={page.status} className="scale-90" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{page.metadata?.path || "/"}</div>
                    </div>
                  </div>

                  {/* Actions / Status Indicators */}
                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {readOnly ? (
                      hasChildren && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full font-medium">
                            {children.length} Elements
                          </span>
                        </div>
                      )
                    ) : isDecomposing ? (
                      <div className="flex items-center gap-2 text-xs text-blue-500 dark:text-blue-400 font-semibold">
                        <Spinner size="sm" />
                        Decomposing...
                      </div>
                    ) : !hasChildren ? (
                      <button
                        onClick={() => onDecomposePage && onDecomposePage(page.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Decompose
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full font-medium">
                          {children.length} Elements
                        </span>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to re-decompose this page? This will overwrite existing child components for this page.")) {
                              onDecomposePage && onDecomposePage(page.id);
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all cursor-pointer"
                          title="Re-decompose (overwrite)"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Redo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Children Sections */}
                {isExpanded && hasChildren && (
                  <div className="border-t border-border bg-muted/10 p-4 space-y-4">
                    {categories.map((cat) => {
                      const catNodes = groupedChildren[cat.type] || [];
                      if (catNodes.length === 0) return null;

                      return (
                        <div key={cat.type} className="space-y-2">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 border-l border-border">
                            {cat.label}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-3">
                            {catNodes.map((child: any) => (
                              <div
                                key={child.id}
                                onClick={() => onSelectNode(child)}
                                className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                  activeNodeId === child.id
                                    ? "bg-muted border-zinc-400 dark:border-zinc-700 text-foreground shadow-sm font-medium"
                                    : "bg-card/50 border-border hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <NodeIcon type={child.type} size={13} />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                      <span className={activeNodeId === child.id ? "text-foreground" : "text-foreground/90"}>{child.name}</span>
                                      {child.metadata?.atomicType && (
                                        <span className="text-[10px] font-normal uppercase text-muted-foreground px-1 border border-border bg-background rounded">
                                          {child.metadata.atomicType}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate mt-0.5 max-w-[200px]">
                                      {child.description}
                                    </div>
                                  </div>
                                </div>
                                
                                {child.status && child.status !== "draft" && (
                                  <Badge status={child.status} className="scale-75 origin-right" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
