import React from "react";

interface CanvasSelectionProps {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export default function CanvasSelection({ x, y, width, height, zoom }: CanvasSelectionProps) {
  return (
    <div 
      className="absolute border-2 border-blue-500 pointer-events-none rounded-xl z-20 transition-all duration-75"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`
      }}
    >
      {/* Dimensions Badge */}
      <div 
        className="absolute bottom-full mb-1.5 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap select-none"
        style={{
          transform: `translate(-50%) scale(${Math.max(0.65, 1 / zoom)})`
        }}
      >
        {Math.round(width)} × {Math.round(height)}
      </div>
    </div>
  );
}
