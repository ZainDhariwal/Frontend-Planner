import React, { useState, useEffect } from "react";
import { X, ShieldAlert, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSettingsChanged }: SettingsModalProps) {
  const [provider, setProvider] = useState<"gemini" | "anthropic">("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedProvider = localStorage.getItem("llm_provider") as "gemini" | "anthropic" | null;
      if (storedProvider) setProvider(storedProvider);
      
      const storedGemini = localStorage.getItem("gemini_api_key") || "";
      const storedAnthropic = localStorage.getItem("anthropic_api_key") || "";
      setGeminiKey(storedGemini);
      setAnthropicKey(storedAnthropic);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("llm_provider", provider);
      localStorage.setItem("gemini_api_key", geminiKey.trim());
      localStorage.setItem("anthropic_api_key", anthropicKey.trim());
      setSaved(true);
      if (onSettingsChanged) onSettingsChanged();
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Frosted backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative border border-zinc-800 bg-zinc-950/90 backdrop-blur-xl rounded-2xl w-full max-w-md p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-400" />
            <h3 className="font-bold text-lg text-zinc-100">Planner Settings</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-white p-1 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Default LLM Provider</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProvider("gemini")}
                className={`py-2 px-3 border rounded-xl font-medium text-xs transition-all cursor-pointer ${
                  provider === "gemini"
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                }`}
              >
                Google Gemini
              </button>
              <button
                onClick={() => setProvider("anthropic")}
                className={`py-2 px-3 border rounded-xl font-medium text-xs transition-all cursor-pointer ${
                  provider === "anthropic"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                }`}
              >
                Anthropic Claude
              </button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gemini API Key (Paid/Custom)</label>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-blue-400 hover:underline"
              >
                Get Key
              </a>
            </div>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-900/50 rounded-xl px-3.5 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-700 transition-all placeholder:text-zinc-600"
            />
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Anthropic API Key (Custom)</label>
              <a 
                href="https://console.anthropic.com/settings/keys" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-amber-400 hover:underline"
              >
                Get Key
              </a>
            </div>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-900/50 rounded-xl px-3.5 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-700 transition-all placeholder:text-zinc-600"
            />
          </div>

          {/* Security Notice */}
          <div className="border border-zinc-900 bg-zinc-950 p-3.5 rounded-xl flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              <strong>Security Policy:</strong> Your keys are stored locally on your device and are only transmitted directly to the backend API over secure HTTPS headers. They are never saved in the planner database.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4 mt-6">
          <Button 
            onClick={onClose} 
            variant="ghost" 
            className="text-zinc-400 hover:text-white text-xs h-9 px-4 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className={`text-xs h-9 px-4 cursor-pointer font-semibold transition-all ${
              saved 
                ? "bg-green-600 hover:bg-green-600 text-white" 
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/15"
            }`}
          >
            {saved ? "Saved Settings!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
