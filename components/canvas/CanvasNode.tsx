import React, { useState, useEffect } from "react";
import { NodeIcon } from "@/components/atoms/NodeIcon";
import { Badge } from "@/components/atoms/Badge";
import CanvasResizeHandle from "./CanvasResizeHandle";
import { Trash2 } from "lucide-react";

interface CanvasNodeProps {
  node: any;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, direction: "se" | "e" | "s") => void;
  onRename: (newName: string) => void;
  readOnly?: boolean;
  onDelete?: (e: React.MouseEvent) => void;
}

export default function CanvasNode({
  node,
  isSelected,
  onSelect,
  onResizeStart,
  onRename,
  readOnly = false,
  onDelete
}: CanvasNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(node.name || "");

  useEffect(() => {
    setTempName(node.name || "");
  }, [node.name]);

  const x = node.metadata?.canvas?.x ?? 0;
  const y = node.metadata?.canvas?.y ?? 0;
  const w = node.metadata?.canvas?.width ?? 200;
  const h = node.metadata?.canvas?.height ?? 100;
  const type = node.metadata?.atomicType || "component";

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (tempName.trim() !== "" && tempName.trim() !== node.name) {
      onRename(tempName.trim());
    } else {
      setTempName(node.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setTempName(node.name);
    }
  };

  // Determine styling based on Atomic Type
  const atomicStyles: Record<string, { border: string; bg: string; badge: string }> = {
    organism: {
      border: "border-indigo-500/20 dark:border-indigo-500/30",
      bg: "bg-indigo-500/5 dark:bg-indigo-500/10",
      badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    },
    molecule: {
      border: "border-purple-500/20 dark:border-purple-500/30",
      bg: "bg-purple-500/5 dark:bg-purple-500/10",
      badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400"
    },
    atom: {
      border: "border-blue-500/20 dark:border-blue-500/30",
      bg: "bg-blue-500/5 dark:bg-blue-500/10",
      badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400"
    }
  };

  const style = atomicStyles[type] || {
    border: "border-border",
    bg: "bg-card/60",
    badge: "bg-muted text-muted-foreground"
  };

  return (
    <div
      className={`absolute border rounded-xl shadow-sm p-3.5 select-none transition-all flex flex-col justify-between group overflow-hidden ${
        style.border
      } ${style.bg} ${
        isSelected 
          ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-950 shadow-md scale-[1.01]" 
          : "hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-800"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: isSelected ? 10 : (type === "organism" ? 2 : 5)
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return; // Only left click selects/drags
        e.stopPropagation();
        onSelect(e);
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-background border border-primary px-1.5 py-0.5 rounded text-xs font-bold outline-none text-foreground w-full font-sans select-text"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="font-extrabold text-xs text-foreground truncate flex items-center gap-1.5 max-w-full">
              <NodeIcon type="component" size={13} />
              <span className="truncate">{node.name}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1.5 shrink-0">
            {!readOnly && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-all cursor-pointer"
                title="Delete component"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-current/10 shrink-0 select-none ${style.badge}`}>
              {type}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-normal line-clamp-3 select-none">
          {node.description || "No description provided."}
        </p>
      </div>

      {node.status && node.status !== "draft" && (
        <div className="flex justify-end mt-1 shrink-0">
          <Badge status={node.status} className="scale-75 origin-bottom-right" />
        </div>
      )}

      {/* Resize Handle overlay */}
      {isSelected && (
        <CanvasResizeHandle 
          onResizeStart={onResizeStart} 
          readOnly={readOnly} 
        />
      )}
    </div>
  );
}
