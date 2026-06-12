import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Check, 
  XCircle, 
  Sparkles, 
  Copy, 
  CheckCheck,
  Plus, 
  Trash2,
  Cpu,
  Info,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

interface NodeEditorProps {
  node: any;
  planId: string;
  onNodeUpdated: (updatedNode: any) => void;
  onClose: () => void;
}

export default function NodeEditor({ node, planId, onNodeUpdated, onClose }: NodeEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "accepted" | "rejected" | "regenerating">("draft");
  const [metadata, setMetadata] = useState<any>({});
  
  // Regeneration state
  const [instruction, setInstruction] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quotaFallback, setQuotaFallback] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (node) {
      setName(node.name || "");
      setDescription(node.description || "");
      setStatus(node.status || "draft");
      setMetadata(node.metadata || {});
      setInstruction("");
    }
  }, [node]);

  if (!node) return null;

  // Handle local property save
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("plan_nodes")
        .update({
          name,
          description,
          status,
          metadata,
          updated_at: new Date().toISOString()
        })
        .eq("id", node.id)
        .select()
        .single();

      if (error) throw error;
      onNodeUpdated(data);
    } catch (err) {
      console.error("Failed to save node:", err);
      alert("Error saving node changes.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: "accepted" | "rejected") => {
    try {
      setStatus(newStatus);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("plan_nodes")
        .update({ status: newStatus })
        .eq("id", node.id)
        .select()
        .single();

      if (error) throw error;
      onNodeUpdated(data);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Trigger AI Node Regeneration
  const handleRegenerate = async (e?: any, skipCustomKey: boolean = false) => {
    if (!instruction.trim()) {
      alert("Please provide an instruction for the AI.");
      return;
    }

    let isRetrying = false;
    try {
      setIsRegenerating(true);
      
      // Get settings from local storage
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = skipCustomKey
        ? null
        : (provider === "gemini" 
          ? localStorage.getItem("gemini_api_key") 
          : localStorage.getItem("anthropic_api_key"));

      const response = await fetch("/api/plans/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customKey ? { "x-api-key": customKey } : {})
        },
        body: JSON.stringify({
          planId,
          nodeId: node.id,
          instruction: instruction.trim(),
          provider
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Regeneration failed");
      }

      if (result.success && result.node) {
        onNodeUpdated(result.node);
        setInstruction("");
        setStatus(result.node.status);
        setMetadata(result.node.metadata);
        setName(result.node.name);
        setDescription(result.node.description);
      }
    } catch (err: any) {
      console.error("Regeneration error:", err);

      const errorMsg = err.message || "";
      const isQuota = errorMsg.toLowerCase().includes("quota") || 
                      errorMsg.toLowerCase().includes("limit") || 
                      errorMsg.toLowerCase().includes("rate limit") ||
                      errorMsg.toLowerCase().includes("429");
      
      const provider = localStorage.getItem("llm_provider") || "gemini";
      const customKey = provider === "gemini" 
        ? localStorage.getItem("gemini_api_key") 
        : localStorage.getItem("anthropic_api_key");

      if (isQuota && customKey && !skipCustomKey) {
        isRetrying = true;
        setQuotaFallback({
          title: "API Key Quota Exceeded",
          description: "Your custom API key has run out of quota limits. Would you like to retry regenerating this node using the default system API key (free version) instead?",
          onConfirm: () => {
            handleRegenerate(undefined, true);
          }
        });
        return;
      }

      alert(`Regeneration failed: ${err.message}`);
    } finally {
      if (!isRetrying) {
        setIsRegenerating(false);
      }
    }
  };

  // Generate copyable agent prompt
  const generateAgentPrompt = () => {
    let prompt = `System Role: Implement a production-grade file based on this project plan specification.\n\n`;
    prompt += `Target Framework: Next.js\n`;
    prompt += `Element Type: ${node.type.toUpperCase()}\n`;
    prompt += `Name: ${name}\n`;
    prompt += `Description: ${description}\n`;
    
    if (node.type === "page") {
      prompt += `Route Path: ${metadata.path || "/"}\n`;
    } else if (node.type === "component") {
      prompt += `Atomic Level: ${metadata.atomicType || "component"}\n`;
      if (metadata.props && metadata.props.length > 0) {
        prompt += `Expected Props Interface:\n`;
        metadata.props.forEach((p: any) => {
          prompt += `- ${p.name}: ${p.type} (${p.description})\n`;
        });
      }
    } else if (node.type === "hook") {
      prompt += `Expected Inputs: ${metadata.inputs || "None"}\n`;
      prompt += `Expected Outputs: ${metadata.outputs || "None"}\n`;
    } else if (node.type === "context") {
      prompt += `Value Interface Shape: ${metadata.valueShape || "None"}\n`;
    } else if (node.type === "data_shape") {
      prompt += `TypeScript Interface Syntax:\n${metadata.tsInterface || ""}\n`;
    } else if (node.type === "mock_data") {
      prompt += `JSON Data Structure:\n${metadata.jsonData || "[]"}\n`;
    }

    if (metadata.dependsOn && metadata.dependsOn.length > 0) {
      prompt += `\nDependencies (Integrate these imports/usages): ${metadata.dependsOn.join(", ")}\n`;
    }

    prompt += `\nTask: Please write the complete, clean code for this ${node.type}. Do not use mock placeholders where metadata shapes are provided. Ensure proper error handling and clean Tailwind classes.`;
    return prompt;
  };

  const handleCopyPrompt = () => {
    const text = generateAgentPrompt();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Component Props Form Handler
  const handlePropChange = (index: number, field: string, value: string) => {
    const newProps = [...(metadata.props || [])];
    newProps[index] = { ...newProps[index], [field]: value };
    setMetadata({ ...metadata, props: newProps });
  };

  const addPropField = () => {
    const newProps = [...(metadata.props || []), { name: "", type: "string", description: "" }];
    setMetadata({ ...metadata, props: newProps });
  };

  const removePropField = (index: number) => {
    const newProps = [...(metadata.props || [])].filter((_, i) => i !== index);
    setMetadata({ ...metadata, props: newProps });
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground border-l border-border w-full animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{node.type} Node</span>
            <Badge status={status} />
          </div>
          <h4 className="font-bold text-sm text-foreground mt-0.5 truncate max-w-[200px]">{node.name}</h4>
        </div>
        <button 
          onClick={onClose} 
          className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Editor Content Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name & Description */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Node Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Type-Specific Metadata Form */}
        <div className="border-t border-border pt-4 space-y-3">
          {node.type === "page" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">URL Route Path</label>
              <input
                type="text"
                value={metadata.path || ""}
                onChange={(e) => setMetadata({ ...metadata, path: e.target.value })}
                className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors font-mono"
              />
            </div>
          )}

          {node.type === "component" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Atomic Level</label>
                <select
                  value={metadata.atomicType || "atom"}
                  onChange={(e) => setMetadata({ ...metadata, atomicType: e.target.value })}
                  className="w-full border border-border bg-background rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none cursor-pointer"
                >
                  <option value="atom">Atom (Smallest basic primitive)</option>
                  <option value="molecule">Molecule (Combination of atoms)</option>
                  <option value="organism">Organism (Complex standalone layout)</option>
                </select>
              </div>

              {/* Props Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Props Properties</label>
                  <button
                    onClick={addPropField}
                    className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Prop
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(metadata.props || []).map((prop: any, index: number) => (
                    <div key={index} className="border border-border bg-muted/40 p-2 rounded-lg flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="name"
                        value={prop.name}
                        onChange={(e) => handlePropChange(index, "name", e.target.value)}
                        className="w-1/3 border border-border bg-background rounded px-2 py-1 text-xs text-foreground outline-none"
                      />
                      <input
                        type="text"
                        placeholder="type"
                        value={prop.type}
                        onChange={(e) => handlePropChange(index, "type", e.target.value)}
                        className="w-1/3 border border-border bg-background rounded px-2 py-1 text-xs text-foreground outline-none font-mono"
                      />
                      <input
                        type="text"
                        placeholder="desc"
                        value={prop.description}
                        onChange={(e) => handlePropChange(index, "description", e.target.value)}
                        className="w-1/3 border border-border bg-background rounded px-2 py-1 text-xs text-foreground outline-none"
                      />
                      <button
                        onClick={() => removePropField(index)}
                        className="text-muted-foreground hover:text-red-500 p-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {node.type === "hook" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Input Parameters</label>
                <input
                  type="text"
                  value={metadata.inputs || ""}
                  onChange={(e) => setMetadata({ ...metadata, inputs: e.target.value })}
                  placeholder="e.g. invoiceId: string, limit?: number"
                  className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Output / Return Value</label>
                <input
                  type="text"
                  value={metadata.outputs || ""}
                  onChange={(e) => setMetadata({ ...metadata, outputs: e.target.value })}
                  placeholder="e.g. { data: Invoice, loading: boolean }"
                  className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors"
                />
              </div>
            </div>
          )}

          {node.type === "context" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Value Shape Interface</label>
              <textarea
                value={metadata.valueShape || ""}
                onChange={(e) => setMetadata({ ...metadata, valueShape: e.target.value })}
                rows={4}
                placeholder="e.g. { user: User | null, logout: () => Promise<void> }"
                className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors font-mono"
              />
            </div>
          )}

          {node.type === "data_shape" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">TypeScript Interface</label>
              <textarea
                value={metadata.tsInterface || ""}
                onChange={(e) => setMetadata({ ...metadata, tsInterface: e.target.value })}
                rows={5}
                className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors font-mono"
              />
            </div>
          )}

          {node.type === "mock_data" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">JSON Mock Data</label>
              <textarea
                value={metadata.jsonData || ""}
                onChange={(e) => setMetadata({ ...metadata, jsonData: e.target.value })}
                rows={5}
                className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors font-mono"
              />
            </div>
          )}
        </div>

        {/* Local Save Changes Button */}
        <Button
          onClick={handleSave}
          disabled={saveLoading}
          className="w-full bg-muted hover:bg-accent text-foreground border border-border text-xs font-semibold h-8 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {saveLoading ? (
            <div className="h-3.5 w-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save local details
        </Button>

        {/* Status approval workflow */}
        <div className="border-t border-border pt-4 space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Approval Status</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleUpdateStatus("accepted")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                status === "accepted"
                  ? "border-green-500/40 bg-green-500/10 text-green-500 dark:text-green-400"
                  : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button
              onClick={() => handleUpdateStatus("rejected")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                status === "rejected"
                  ? "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400"
                  : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </div>

        {/* AI Node Regeneration */}
        <div className="border-t border-border pt-4 space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            AI Node Regeneration
          </label>
          <p className="text-xs text-muted-foreground leading-normal">
            Instruct the AI to rewrite this specific element properties (name, props, shapes, etc.) based on your changes.
          </p>
          <div className="space-y-2">
            <textarea
              placeholder="e.g. Add an isLoading prop. Or, change return structure to support paging."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              disabled={isRegenerating}
              className="w-full border border-border bg-background rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-blue-500 dark:focus:border-zinc-700 transition-colors resize-none disabled:opacity-50"
            />
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating || !instruction.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold h-8 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              {isRegenerating ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-zinc-200 border-t-transparent rounded-full animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Node
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Agent Prompt Generator */}
        <div className="border-t border-border pt-4 space-y-2 pb-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              Agent Prompt Generator
            </label>
            <button
              onClick={handleCopyPrompt}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors cursor-pointer"
            >
              {copied ? (
                <CheckCheck className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-normal">
            Copy this formatted specification prompt to feed directly to Cursor, Claude Code, or any coding agent.
          </p>
          <div className="border border-border bg-muted/40 p-3 rounded-lg max-h-36 overflow-y-auto scrollbar-thin">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed select-all">
              {generateAgentPrompt()}
            </pre>
          </div>
        </div>
      </div>

      {/* Quota Fallback Modal */}
      {quotaFallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setQuotaFallback(null)} />
          <div className="relative border border-border bg-card p-6 rounded-2xl w-full max-w-md shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg text-amber-500 flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              {quotaFallback.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-normal mb-6">
              {quotaFallback.description}
            </p>
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button 
                onClick={() => setQuotaFallback(null)} 
                variant="ghost" 
                className="text-muted-foreground hover:text-foreground text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const onConfirm = quotaFallback.onConfirm;
                  setQuotaFallback(null);
                  onConfirm();
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 px-4 cursor-pointer font-semibold shadow-lg shadow-blue-500/10"
              >
                Yes, Use Free Version
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
