import React from "react";

interface BadgeProps {
  status: "draft" | "accepted" | "rejected" | "regenerating";
  className?: string;
}

export function Badge({ status, className = "" }: BadgeProps) {
  const styles = {
    draft: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    accepted: "border-green-500/30 bg-green-500/10 text-green-400",
    rejected: "border-red-500/30 bg-red-500/10 text-red-400",
    regenerating: "border-blue-500/30 bg-blue-500/10 text-blue-400 animate-pulse"
  };

  const labels = {
    draft: "Draft",
    accepted: "Accepted",
    rejected: "Rejected",
    regenerating: "Regenerating..."
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${styles[status]} ${className}`}>
      {labels[status]}
    </span>
  );
}
