import React, { useRef, useState, useEffect } from "react";
import CanvasGrid from "./CanvasGrid";
import CanvasNode from "./CanvasNode";
import CanvasSelection from "./CanvasSelection";

interface CanvasBoardProps {
  nodes: any[];
  selectedNodeId: string | null;
  onSelectNode: (node: any | null) => void;
  onUpdateNodeCoordinates: (id: string, x: number, y: number, w: number, h: number) => void;
  onAddNode: (type: string, atomicType: string, x: number, y: number) => void;
  onRenameNode: (id: string, newName: string) => void;
  onUpdateParent: (id: string, parentId: string | null) => void;
  panX: number;
  panY: number;
  zoom: number;
  setPanX: React.Dispatch<React.SetStateAction<number>>;
  setPanY: React.Dispatch<React.SetStateAction<number>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  readOnly?: boolean;
}

export default function CanvasBoard({
  nodes,
  selectedNodeId,
  onSelectNode,
  onUpdateNodeCoordinates,
  onAddNode,
  onRenameNode,
  onUpdateParent,
  panX,
  panY,
  zoom,
  setPanX,
  setPanY,
  setZoom,
  readOnly = false
}: CanvasBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Dragging/Panning states
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<{ id: string; startX: number; startY: number; mouseStartX: number; mouseStartY: number; currentX: number; currentY: number } | null>(null);
  const [resizingNode, setResizingNode] = useState<{ id: string; startW: number; startH: number; mouseStartX: number; mouseStartY: number; direction: "se" | "e" | "s"; startX: number; startY: number; currentW: number; currentH: number } | null>(null);

  // Filter page components
  const canvasNodes = nodes.filter(n => n.type === "component");

  // Get active selected node
  const activeSelectedNode = canvasNodes.find(n => n.id === selectedNodeId);

  // Wheel pan or zoom handler (Figma/Miro style)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!boardRef.current) return;
    
    const isZooming = e.metaKey || e.ctrlKey;
    
    if (isZooming) {
      const rect = boardRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom factor increments
      const zoomIntensity = 0.05;
      const wheel = e.deltaY < 0 ? 1 : -1;
      const nextZoom = Math.min(Math.max(0.15, zoom + wheel * zoomIntensity), 2);
      
      // Adjust pan coordinates to center zoom on mouse cursor
      setPanX(prev => mouseX - (mouseX - prev) * (nextZoom / zoom));
      setPanY(prev => mouseY - (mouseY - prev) * (nextZoom / zoom));
      setZoom(nextZoom);
    } else {
      // Swipe/roll vertically to pan up/down, horizontally to pan left/right
      setPanX(prev => prev - e.deltaX);
      setPanY(prev => prev - e.deltaY);
    }
  };

  // Drag over handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Drag Drop handler (Adding new items from Sidebar)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly || !boardRef.current) return;

    try {
      const dataStr = e.dataTransfer.getData("application/reactflow");
      if (!dataStr) return;

      const item = JSON.parse(dataStr);
      const rect = boardRef.current.getBoundingClientRect();
      
      // Calculate coordinates relative to grid zoom & pan offsets
      const dropX = (e.clientX - rect.left - panX) / zoom;
      const dropY = (e.clientY - rect.top - panY) / zoom;

      onAddNode(item.name, item.type, dropX, dropY);
    } catch (err) {
      console.error("Failed to parse drop item data:", err);
    }
  };

  // Mouse Down - Pan Board or Drag Node
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking background board, trigger Panning
    if (e.target === boardRef.current || (e.target as HTMLElement).classList.contains("grid-bg-trigger")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      onSelectNode(null);
    }
  };

  // Global mousemove and mouseup listeners to prevent cursor slipping/sticking
  useEffect(() => {
    if (!isPanning && !draggedNode && !resizingNode) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPanX(e.clientX - panStart.x);
        setPanY(e.clientY - panStart.y);
      } else if (draggedNode && !readOnly) {
        const deltaX = (e.clientX - draggedNode.mouseStartX) / zoom;
        const deltaY = (e.clientY - draggedNode.mouseStartY) / zoom;
        
        setDraggedNode(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentX: Math.round(prev.startX + deltaX),
            currentY: Math.round(prev.startY + deltaY)
          };
        });
      } else if (resizingNode && !readOnly) {
        const deltaX = (e.clientX - resizingNode.mouseStartX) / zoom;
        const deltaY = (e.clientY - resizingNode.mouseStartY) / zoom;

        setResizingNode(prev => {
          if (!prev) return null;
          let nextW = prev.startW;
          let nextH = prev.startH;

          if (prev.direction === "e" || prev.direction === "se") {
            nextW = Math.max(100, prev.startW + deltaX);
          }
          if (prev.direction === "s" || prev.direction === "se") {
            nextH = Math.max(60, prev.startH + deltaY);
          }

          return {
            ...prev,
            currentW: Math.round(nextW),
            currentH: Math.round(nextH)
          };
        });
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      } else if (draggedNode && !readOnly) {
        const { id, currentX, currentY } = draggedNode;
        setDraggedNode(null);

        const node = canvasNodes.find(n => n.id === id);
        if (!node) return;

        const currentW = node.metadata?.canvas?.width ?? 200;
        const currentH = node.metadata?.canvas?.height ?? 100;

        // 1. Save final coordinates to database once
        onUpdateNodeCoordinates(id, currentX, currentY, currentW, currentH);

        // 2. Perform Geometric Containment calculation to set parenting
        let parentId: string | null = null;
        let smallestParentArea = Infinity;

        canvasNodes.forEach(other => {
          if (other.id === id) return;
          if (other.metadata?.atomicType !== "organism") return;

          const otherX = other.metadata?.canvas?.x ?? 0;
          const otherY = other.metadata?.canvas?.y ?? 0;
          const otherW = other.metadata?.canvas?.width ?? 200;
          const otherH = other.metadata?.canvas?.height ?? 100;

          // Bounding containment check
          const isContained = 
            currentX >= otherX &&
            currentY >= otherY &&
            (currentX + currentW) <= (otherX + otherW) &&
            (currentY + currentH) <= (otherY + otherH);

          if (isContained) {
            const area = otherW * otherH;
            if (area < smallestParentArea) {
              smallestParentArea = area;
              parentId = other.id;
            }
          }
        });

        // Fire parenting update trigger
        if (node.parent_id !== parentId) {
          onUpdateParent(id, parentId);
        }
      } else if (resizingNode && !readOnly) {
        const { id, currentW, currentH, startX, startY } = resizingNode;
        setResizingNode(null);

        // Save final size to database once
        onUpdateNodeCoordinates(id, startX, startY, currentW, currentH);
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isPanning, draggedNode, resizingNode, panStart, zoom, readOnly, canvasNodes, onUpdateNodeCoordinates, onUpdateParent]);

  const handleNodeMouseDown = (e: React.MouseEvent, node: any) => {
    if (readOnly) {
      onSelectNode(node);
      return;
    }
    
    e.stopPropagation();
    onSelectNode(node);
    
    const x = node.metadata?.canvas?.x ?? 0;
    const y = node.metadata?.canvas?.y ?? 0;
    
    setDraggedNode({
      id: node.id,
      startX: x,
      startY: y,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      currentX: x,
      currentY: y
    });
  };

  const handleNodeResizeStart = (e: React.MouseEvent, node: any, direction: "se" | "e" | "s") => {
    e.stopPropagation();
    
    const x = node.metadata?.canvas?.x ?? 0;
    const y = node.metadata?.canvas?.y ?? 0;
    const w = node.metadata?.canvas?.width ?? 200;
    const h = node.metadata?.canvas?.height ?? 100;

    setResizingNode({
      id: node.id,
      startX: x,
      startY: y,
      startW: w,
      startH: h,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      direction,
      currentW: w,
      currentH: h
    });
  };

  return (
    <div
      ref={boardRef}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      className={`flex-1 relative overflow-hidden outline-none bg-background/50 grid-bg-trigger cursor-grab active:cursor-grabbing`}
    >
      {/* Grid Dots */}
      <CanvasGrid panX={panX} panY={panY} zoom={zoom} />

      {/* Main Board Container */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-75"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0"
        }}
      >
        {/* Render Canvas Nodes with temporary local coordinates overrides */}
        {canvasNodes.map(node => {
          let nodeToRender = node;
          if (draggedNode && draggedNode.id === node.id) {
            nodeToRender = {
              ...node,
              metadata: {
                ...node.metadata,
                canvas: {
                  ...node.metadata?.canvas,
                  x: draggedNode.currentX,
                  y: draggedNode.currentY
                }
              }
            };
          } else if (resizingNode && resizingNode.id === node.id) {
            nodeToRender = {
              ...node,
              metadata: {
                ...node.metadata,
                canvas: {
                  ...node.metadata?.canvas,
                  width: resizingNode.currentW,
                  height: resizingNode.currentH
                }
              }
            };
          }

          return (
            <div key={node.id} className="pointer-events-auto">
              <CanvasNode
                node={nodeToRender}
                isSelected={node.id === selectedNodeId}
                onSelect={(e) => handleNodeMouseDown(e, node)}
                onResizeStart={(e, dir) => handleNodeResizeStart(e, node, dir)}
                onRename={(newName) => onRenameNode(node.id, newName)}
                readOnly={readOnly}
              />
            </div>
          );
        })}

        {/* Selection Indicator Bounding Box (following local coordinates) */}
        {activeSelectedNode && (
          <CanvasSelection
            x={
              draggedNode && draggedNode.id === activeSelectedNode.id 
                ? draggedNode.currentX 
                : activeSelectedNode.metadata?.canvas?.x ?? 0
            }
            y={
              draggedNode && draggedNode.id === activeSelectedNode.id 
                ? draggedNode.currentY 
                : activeSelectedNode.metadata?.canvas?.y ?? 0
            }
            width={
              resizingNode && resizingNode.id === activeSelectedNode.id 
                ? resizingNode.currentW 
                : activeSelectedNode.metadata?.canvas?.width ?? 200
            }
            height={
              resizingNode && resizingNode.id === activeSelectedNode.id 
                ? resizingNode.currentH 
                : activeSelectedNode.metadata?.canvas?.height ?? 100
            }
            zoom={zoom}
          />
        )}
      </div>
    </div>
  );
}
