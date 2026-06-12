import React from "react";
import { Coins } from "lucide-react";

interface CostIndicatorProps {
  cost: number;
  className?: string;
}

export function CostIndicator({ cost, className = "" }: CostIndicatorProps) {
  // Format cost with appropriate decimal places
  const formattedCost = cost === 0 
    ? "$0.00" 
    : cost < 0.01 
      ? `$${cost.toFixed(6)}` 
      : `$${cost.toFixed(4)}`;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur-md ${className}`}>
      <Coins className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />
      <span className="text-xs text-muted-foreground font-medium">
        Cost: <span className="text-foreground font-semibold">{formattedCost}</span>
      </span>
    </div>
  );
}
