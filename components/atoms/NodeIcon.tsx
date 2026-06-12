import React from "react";
import { 
  FileCode, 
  Blocks, 
  Anchor, 
  Cpu, 
  Braces, 
  Boxes, 
  Image, 
  Package,
  HelpCircle
} from "lucide-react";

interface NodeIconProps {
  type: string;
  className?: string;
  size?: number;
}

export function NodeIcon({ type, className = "", size = 16 }: NodeIconProps) {
  const configs: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
    page: { icon: FileCode, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    component: { icon: Blocks, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    hook: { icon: Anchor, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    context: { icon: Cpu, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
    data_shape: { icon: Braces, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    mock_data: { icon: Boxes, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    asset: { icon: Image, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
    lib: { icon: Package, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" }
  };

  const config = configs[type] || { icon: HelpCircle, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" };
  const IconComponent = config.icon;

  return (
    <div className={`p-1.5 rounded-lg border flex items-center justify-center ${config.bg} ${config.color} ${className}`}>
      <IconComponent style={{ width: size, height: size }} />
    </div>
  );
}
