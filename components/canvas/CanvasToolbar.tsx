import React from "react";
import { 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Maximize2, 
  Sparkles, 
  Cpu, 
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView: () => void;
  onSyncAI: () => void;
  onSuggestAI: () => void;
  isSyncing: boolean;
  isSuggesting: boolean;
  readOnly?: boolean;
}

export default function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  onSyncAI,
  onSuggestAI,
  isSyncing,
  isSuggesting,
  readOnly = false
}: CanvasToolbarProps) {
  return (
    <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-card/85 backdrop-blur-xl border border-border px-3 py-2 rounded-2xl shadow-2xl flex items-center gap-2 z-20 transition-all select-none">
      {/* Zoom Actions */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <Button
          onClick={onZoomOut}
          variant="ghost"
          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          onClick={onZoomIn}
          variant="ghost"
          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          onClick={onFitView}
          variant="ghost"
          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          title="Fit View"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          onClick={onResetView}
          variant="ghost"
          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          title="Reset View"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* AI Controls */}
      <div className="flex items-center gap-2 pl-1">
        <Button
          disabled={readOnly || isSuggesting}
          onClick={onSuggestAI}
          variant="outline"
          className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border-border bg-card hover:bg-muted text-foreground cursor-pointer"
        >
          {isSuggesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          )}
          Suggest Layout
        </Button>

        <Button
          disabled={readOnly || isSyncing}
          onClick={onSyncAI}
          className="h-8 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10 cursor-pointer"
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Cpu className="h-3.5 w-3.5" />
          )}
          AI Blueprint Sync
        </Button>
      </div>
    </div>
  );
}
