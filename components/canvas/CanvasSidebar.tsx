import React from "react";
import { 
  Square, 
  Columns, 
  Menu, 
  Type, 
  Play, 
  CreditCard, 
  ListTodo, 
  Search, 
  TableProperties,
  ArrowRightLeft
} from "lucide-react";

interface CanvasSidebarProps {
  readOnly?: boolean;
}

export default function CanvasSidebar({ readOnly = false }: CanvasSidebarProps) {
  const categories = [
    {
      title: "Organisms",
      items: [
        { name: "Section", type: "organism", icon: Square, desc: "Outer section layout block" },
        { name: "Container", type: "organism", icon: Columns, desc: "Flex/grid containment panel" },
        { name: "Header", type: "organism", icon: Menu, desc: "Top bar block" },
        { name: "Sidebar", type: "organism", icon: Columns, desc: "Left navigation sidebar" },
        { name: "DashboardPanel", type: "organism", icon: Columns, desc: "Self-contained dashboard box" }
      ]
    },
    {
      title: "Molecules",
      items: [
        { name: "Card", type: "molecule", icon: CreditCard, desc: "Structured visual card element" },
        { name: "Form", type: "molecule", icon: ListTodo, desc: "Input form container" },
        { name: "SearchBar", type: "molecule", icon: Search, desc: "Text query control" },
        { name: "Table", type: "molecule", icon: TableProperties, desc: "Data grid table representation" }
      ]
    },
    {
      title: "Atoms",
      items: [
        { name: "Text", type: "atom", icon: Type, desc: "Label or paragraph content" },
        { name: "Button", type: "atom", icon: Play, desc: "Interactive button trigger" },
        { name: "Input", type: "atom", icon: Square, desc: "Single text field node" }
      ]
    }
  ];

  const handleDragStart = (e: React.DragEvent, item: any) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/reactflow", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-64 border-r border-border bg-card/30 backdrop-blur-md p-4 flex flex-col gap-5 shrink-0 overflow-y-auto select-none">
      <div>
        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Visual Blocks</h4>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
          {readOnly ? "View component primitives library." : "Drag blocks onto the board to build hierarchy."}
        </p>
      </div>

      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.title} className="space-y-2">
            <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 border-l-2 border-primary/40">
              {cat.title}
            </h5>
            
            <div className="grid grid-cols-1 gap-1.5">
              {cat.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.name}
                    draggable={!readOnly}
                    onDragStart={(e) => handleDragStart(e, item)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card/60 hover:bg-muted/40 transition-all text-xs font-medium cursor-grab active:cursor-grabbing ${
                      readOnly ? "opacity-70 pointer-events-none cursor-default" : ""
                    }`}
                    title={item.desc}
                  >
                    <IconComponent className="h-4 w-4 text-zinc-500" />
                    <div>
                      <div className="font-bold text-foreground">{item.name}</div>
                      <div className="text-[9px] text-muted-foreground font-normal lowercase">{item.type}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
