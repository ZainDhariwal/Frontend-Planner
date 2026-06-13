import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import CanvasSidebar from "./CanvasSidebar";
import CanvasBoard from "./CanvasBoard";
import CanvasToolbar from "./CanvasToolbar";
import CanvasMinimap from "./CanvasMinimap";

interface VisualCanvasProps {
  plan: any;
  pageNode: any;
  nodes: any[];
  onSelectNode: (node: any | null) => void;
  selectedNodeId: string | null;
  onRefreshWorkspace: () => void;
  readOnly?: boolean;
  onDeleteNode?: (id: string) => void;
}

export default function VisualCanvas({
  plan,
  pageNode,
  nodes,
  onSelectNode,
  selectedNodeId,
  onRefreshWorkspace,
  readOnly = false,
  onDeleteNode
}: VisualCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(100);
  const [panY, setPanY] = useState(100);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const supabase = createClient();

  // 1. Filter nodes belonging only to the active page (and its subcomponents/organisms)
  // Memoize to dynamically calculate structured in-memory lane coords for any nodes missing coordinates.
  const { pageComponents, pageComponentIds } = React.useMemo(() => {
    const ids = new Set<string>();
    if (pageNode?.id) {
      nodes.forEach(n => {
        if (n.parent_id === pageNode.id && n.type === "component") {
          ids.add(n.id);
        }
      });
      // Multi-pass hierarchy checking to grab children of organisms nested under this page
      let addedNew = true;
      while (addedNew) {
        addedNew = false;
        nodes.forEach(n => {
          if (n.type === "component" && n.parent_id && !ids.has(n.id) && ids.has(n.parent_id)) {
            ids.add(n.id);
            addedNew = true;
          }
        });
      }
    }

    const filtered = nodes.filter(n => ids.has(n.id));

    // Arrange elements without coordinates in horizontal lanes in-memory
    const organisms = filtered.filter(n => n.metadata?.atomicType === "organism");
    const molecules = filtered.filter(n => n.metadata?.atomicType === "molecule");
    const atoms = filtered.filter(n => n.metadata?.atomicType === "atom");

    let orgX = 50, orgY = 50;
    let molX = 50, molY = 280;
    let atmX = 50, atmY = 440;

    const positioned = filtered.map(node => {
      const hasX = typeof node.metadata?.canvas?.x === "number";
      const hasY = typeof node.metadata?.canvas?.y === "number";
      if (hasX && hasY) return node;

      const type = node.metadata?.atomicType || "component";
      let x = 0, y = 0;
      let w = 200, h = 100;

      if (type === "organism") {
        w = 320; h = 180;
        x = orgX; y = orgY;
        orgX += w + 40;
      } else if (type === "molecule") {
        w = 220; h = 110;
        x = molX; y = molY;
        molX += w + 30;
      } else {
        w = 140; h = 70;
        x = atmX; y = atmY;
        atmX += w + 20;
      }

      return {
        ...node,
        metadata: {
          ...(node.metadata || {}),
          canvas: {
            x,
            y,
            width: node.metadata?.canvas?.width || w,
            height: node.metadata?.canvas?.height || h,
            zIndex: 1,
            collapsed: false
          }
        }
      };
    });

    return { pageComponents: positioned, pageComponentIds: ids };
  }, [nodes, pageNode?.id]);

  // 2. Persist coordinates for newly arranged nodes to Supabase in background
  useEffect(() => {
    if (readOnly || !pageNode || nodes.length === 0) return;

    const missingInDb = nodes.filter(n => {
      if (!pageComponentIds.has(n.id)) return false;
      return typeof n.metadata?.canvas?.x !== "number" || typeof n.metadata?.canvas?.y !== "number";
    });

    if (missingInDb.length === 0) return;

    const updates = missingInDb.map(rawNode => {
      const processedNode = pageComponents.find(p => p.id === rawNode.id);
      if (!processedNode) return Promise.resolve();

      return supabase
        .from("plan_nodes")
        .update({ metadata: processedNode.metadata })
        .eq("id", rawNode.id);
    });

    Promise.all(updates).then(() => {
      onRefreshWorkspace();
    });
  }, [pageNode?.id, nodes, readOnly, pageComponentIds, pageComponents, supabase, onRefreshWorkspace]);

  // Reset viewport when active page changes
  useEffect(() => {
    setZoom(1);
    setPanX(100);
    setPanY(100);
  }, [pageNode?.id]);

  // Toolbar viewport actions
  const handleZoomIn = () => setZoom(prev => Math.min(2, prev + 0.1));
  const handleZoomOut = () => setZoom(prev => Math.max(0.15, prev - 0.1));
  const handleResetView = () => {
    setZoom(1);
    setPanX(100);
    setPanY(100);
  };
  const handleFitView = () => {
    const canvasNodes = pageComponents.filter(n => n.metadata?.canvas);
    if (canvasNodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    canvasNodes.forEach(node => {
      const c = node.metadata.canvas;
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + c.width > maxX) maxX = c.x + c.width;
      if (c.y + c.height > maxY) maxY = c.y + c.height;
    });

    const padding = 50;
    const canvasW = maxX - minX + padding * 2;
    const canvasH = maxY - minY + padding * 2;

    const nextZoom = Math.min(1.2, Math.max(0.2, 500 / Math.max(canvasW, canvasH)));
    setZoom(nextZoom);
    setPanX(padding - minX * nextZoom);
    setPanY(padding - minY * nextZoom);
  };

  // 1. Add visual node block to DB
  const handleAddNode = async (name: string, atomicType: string, x: number, y: number) => {
    if (readOnly) return;
    try {
      const { data, error } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: plan.id,
          parent_id: pageNode.id, // sits under page initially
          type: "component",
          name,
          description: `A layout block representing a ${atomicType}. Double click to edit.`,
          status: "draft",
          metadata: {
            atomicType,
            canvas: {
              x: Math.round(x),
              y: Math.round(y),
              width: atomicType === "organism" ? 320 : atomicType === "molecule" ? 220 : 140,
              height: atomicType === "organism" ? 180 : atomicType === "molecule" ? 110 : 70,
              zIndex: 1,
              collapsed: false
            }
          },
          version: 1
        })
        .select()
        .single();

      if (error) throw error;
      onRefreshWorkspace();
      if (data) onSelectNode(data);
    } catch (err) {
      console.error("Failed to add canvas node:", err);
    }
  };

  // 2. Update coordinates in DB
  const handleUpdateNodeCoordinates = async (id: string, x: number, y: number, w: number, h: number) => {
    if (readOnly) return;
    try {
      // Find local node first
      const node = nodes.find(n => n.id === id);
      if (!node) return;

      const currentMetadata = node.metadata || {};
      const nextMetadata = {
        ...currentMetadata,
        canvas: {
          ...currentMetadata.canvas,
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(w),
          height: Math.round(h)
        }
      };

      // Pessimistic UI update locally so it feels fast during drag
      node.metadata = nextMetadata;

      // Update in background
      await supabase
        .from("plan_nodes")
        .update({ metadata: nextMetadata })
        .eq("id", id);
        
    } catch (err) {
      console.error("Failed to update coordinates in database:", err);
    }
  };

  // 3. Rename node block in DB
  const handleRenameNode = async (id: string, newName: string) => {
    if (readOnly) return;
    try {
      const { error } = await supabase
        .from("plan_nodes")
        .update({ name: newName })
        .eq("id", id);

      if (error) throw error;
      onRefreshWorkspace();
    } catch (err) {
      console.error("Failed to rename node block:", err);
    }
  };

  // 4. Update parent nesting state in DB
  const handleUpdateParent = async (id: string, parentId: string | null) => {
    if (readOnly) return;
    try {
      const targetParentId = parentId || pageNode.id;
      const { error } = await supabase
        .from("plan_nodes")
        .update({ parent_id: targetParentId })
        .eq("id", id);

      if (error) throw error;
      onRefreshWorkspace();
    } catch (err) {
      console.error("Failed to update nesting status in database:", err);
    }
  };

  // 5. Generate AI suggestions layout
  const handleSuggestLayout = async () => {
    if (readOnly) return;
    try {
      setIsSuggesting(true);
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = provider === "gemini" 
        ? localStorage.getItem("gemini_api_key") 
        : localStorage.getItem("anthropic_api_key");

      const response = await fetch(`/api/plans/${plan.id}/canvas-suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customKey ? { "x-api-key": customKey } : {})
        },
        body: JSON.stringify({
          pageId: pageNode.id,
          provider
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to generate suggestions.");

      onRefreshWorkspace();
      handleFitView();
    } catch (err: any) {
      console.error("Failed to suggest layouts:", err);
      alert(`AI Suggestion error: ${err.message}`);
    } finally {
      setIsSuggesting(false);
    }
  };

  // 6. AI Blueprint Sync (Sends layout model, not coordinates)
  const handleSyncAI = async () => {
    if (readOnly) return;
    try {
      setIsSyncing(true);
      const organisms = pageComponents.filter(c => c.metadata?.atomicType === "organism");
      
      // Compile layout nesting model hierarchically (omitting coordinates)
      const layoutModel = {
        page: pageNode.name,
        sections: organisms.map(org => ({
          id: org.id,
          name: org.name,
          type: org.metadata?.atomicType,
          description: org.description,
          children: pageComponents
            .filter(c => c.parent_id === org.id)
            .map(c => ({
              id: c.id,
              name: c.name,
              type: c.metadata?.atomicType,
              description: c.description
            }))
        })),
        unassigned: pageComponents
          .filter(c => !c.parent_id || c.parent_id === pageNode.id)
          .filter(c => c.metadata?.atomicType !== "organism")
          .map(c => ({
            id: c.id,
            name: c.name,
            type: c.metadata?.atomicType,
            description: c.description
          }))
      };

      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = provider === "gemini" 
        ? localStorage.getItem("gemini_api_key") 
        : localStorage.getItem("anthropic_api_key");

      const response = await fetch(`/api/plans/${plan.id}/canvas-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customKey ? { "x-api-key": customKey } : {})
        },
        body: JSON.stringify({
          pageId: pageNode.id,
          layoutModel,
          provider
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to sync visual blueprints.");

      onRefreshWorkspace();
      alert("AI Blueprint Sync Complete! Layout elements updated with properties, props, and custom hooks.");
    } catch (err: any) {
      console.error("AI Sync failed:", err);
      alert(`AI Blueprint Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Sidebar Palette */}
      <CanvasSidebar readOnly={readOnly} />

      {/* Main Canvas Grid and Toolbar */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <CanvasBoard
          nodes={pageComponents}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onUpdateNodeCoordinates={handleUpdateNodeCoordinates}
          onAddNode={handleAddNode}
          onRenameNode={handleRenameNode}
          onUpdateParent={handleUpdateParent}
          panX={panX}
          panY={panY}
          zoom={zoom}
          setPanX={setPanX}
          setPanY={setPanY}
          setZoom={setZoom}
          readOnly={readOnly}
          onDeleteNode={onDeleteNode}
        />

        {/* Floating Controller widgets */}
        <CanvasMinimap panX={panX} panY={panY} zoom={zoom} />

        <CanvasToolbar
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onFitView={handleFitView}
          onSyncAI={handleSyncAI}
          onSuggestAI={handleSuggestLayout}
          isSyncing={isSyncing}
          isSuggesting={isSuggesting}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
