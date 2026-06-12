import React from "react";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className = "", size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-[3px]",
    lg: "h-12 w-12 border-4"
  };

  return (
    <div
      className={`animate-spin rounded-full border-t-blue-500 border-r-blue-400 border-b-zinc-800 border-l-zinc-800 ${sizeClasses[size]} ${className}`}
      style={{
        backdropFilter: "blur(4px)",
        boxShadow: "0 0 15px rgba(59, 130, 246, 0.15)"
      }}
    />
  );
}
