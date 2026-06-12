import React from "react";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";

interface CoherencePanelProps {
  nodes: any[];
  dependencies: any[];
}

interface WarningItem {
  id: string;
  type: "missing" | "rejected" | "circular";
  message: string;
  severity: "high" | "medium";
}

export default function CoherencePanel({ nodes, dependencies }: CoherencePanelProps) {
  const checkCoherence = (): WarningItem[] => {
    const warnings: WarningItem[] = [];
    const nodeMap = new Map<string, any>(nodes.map((n) => [n.id, n]));

    // 1. Check for missing or rejected dependency targets
    dependencies.forEach((dep, idx) => {
      const source = nodeMap.get(dep.source_node_id);
      const target = nodeMap.get(dep.target_node_id);

      if (!source) return;

      if (!target) {
        warnings.push({
          id: `missing-${idx}`,
          type: "missing",
          message: `"${source.name}" references a target element that was deleted or not found.`,
          severity: "high"
        });
      } else if (target.status === "rejected") {
        warnings.push({
          id: `rejected-${idx}`,
          type: "rejected",
          message: `"${source.name}" depends on "${target.name}", which has been rejected.`,
          severity: "high"
        });
      }
    });

    // 2. Check for simple circular dependencies (A -> B -> A)
    const adjList = new Map<string, string[]>();
    dependencies.forEach((dep) => {
      if (!adjList.has(dep.source_node_id)) {
        adjList.set(dep.source_node_id, []);
      }
      adjList.get(dep.source_node_id)!.push(dep.target_node_id);
    });

    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const hasCycle = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, [...path, neighbor])) return true;
        } else if (recStack.has(neighbor)) {
          const cyclePath = [...path, neighbor];
          const cycleNames = cyclePath
            .map((id) => nodeMap.get(id)?.name || "unknown")
            .join(" ➔ ");
          
          warnings.push({
            id: `circular-${nodeId}-${neighbor}`,
            type: "circular",
            message: `Circular dependency path detected: ${cycleNames}`,
            severity: "medium"
          });
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        hasCycle(node.id, [node.id]);
      }
    });

    return warnings;
  };

  const warnings = checkCoherence();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
        <h3 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          Plan Coherence Check
        </h3>
      </div>

      {warnings.length === 0 ? (
        <div className="border border-green-500/20 bg-green-500/5 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-green-600 dark:text-green-400">Coherence Validated</div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              No dependency conflicts, deleted references, or circular loops detected in this plan.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {warnings.map((warn) => (
            <div 
              key={warn.id} 
              className={`border p-3.5 rounded-xl flex items-start gap-3 transition-colors ${
                warn.severity === "high" 
                  ? "border-red-500/20 bg-red-500/5 text-red-500 dark:text-red-400" 
                  : "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-foreground">
                  {warn.type === "circular" ? "Circular Path Warning" : "Reference Error"}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {warn.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
