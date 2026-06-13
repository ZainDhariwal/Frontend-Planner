import React from "react";
import { Compass } from "lucide-react";

interface CanvasMinimapProps {
  panX: number;
  panY: number;
  zoom: number;
}

export default function CanvasMinimap({ panX, panY, zoom }: CanvasMinimapProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="absolute top-5 right-5 bg-card/85 backdrop-blur-xl border border-border p-3 rounded-2xl shadow-xl z-20 flex items-center gap-3 text-xs select-none pointer-events-none">
      <Compass className="h-4.5 w-4.5 text-muted-foreground animate-spin-slow" />
      <div className="font-medium text-muted-foreground space-y-0.5">
        <div>
          Zoom: <span className="text-foreground font-bold">{zoomPercent}%</span>
        </div>
        <div className="text-[10px] font-mono">
          X: {Math.round(panX)} • Y: {Math.round(panY)}
        </div>
      </div>
    </div>
  );
}
