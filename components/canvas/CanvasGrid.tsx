import React from "react";

interface CanvasGridProps {
  panX: number;
  panY: number;
  zoom: number;
}

export default function CanvasGrid({ panX, panY, zoom }: CanvasGridProps) {
  return (
    <div 
      className="absolute inset-0 pointer-events-none transition-all duration-75"
      style={{
        backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
        backgroundSize: `${16 * zoom}px ${16 * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`
      }}
    />
  );
}
