import React from "react";

interface CanvasResizeHandleProps {
  onResizeStart: (e: React.MouseEvent, direction: "se" | "e" | "s") => void;
  readOnly?: boolean;
}

export default function CanvasResizeHandle({ onResizeStart, readOnly = false }: CanvasResizeHandleProps) {
  if (readOnly) return null;

  return (
    <>
      {/* Right side resize handle */}
      <div 
        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary/40 transition-colors z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, "e");
        }}
      />
      {/* Bottom side resize handle */}
      <div 
        className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/40 transition-colors z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, "s");
        }}
      />
      {/* South-East corner resize handle */}
      <div 
        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize border-r-2 border-b-2 border-primary hover:bg-primary/20 transition-colors z-20 m-0.5 rounded-br"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, "se");
        }}
      />
    </>
  );
}
