import React, { useState } from "react";
import { Share2, Globe, Copy, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

interface ShareButtonProps {
  plan: any;
  onPlanUpdated: (updatedPlan: any) => void;
}

export default function ShareButton({ plan, onPlanUpdated }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();
  const isPublic = !!plan.is_public;

  const toggleShareStatus = async () => {
    try {
      setLoading(true);
      const newStatus = !isPublic;
      const { data, error } = await supabase
        .from("plans")
        .update({ is_public: newStatus })
        .eq("id", plan.id)
        .select()
        .single();

      if (error) throw error;
      onPlanUpdated(data);
    } catch (err) {
      console.error("Error toggling plan share status:", err);
      alert("Failed to update plan sharing configuration.");
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/shared/${plan.id}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className={`flex items-center gap-1.5 border-border rounded-lg h-9 px-3 text-xs cursor-pointer font-medium transition-all ${
          isPublic 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" 
            : "bg-card/60 hover:bg-muted text-foreground"
        }`}
      >
        <Share2 className="h-3.5 w-3.5" />
        {isPublic ? "Shared" : "Share"}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-foreground">
            <h3 className="font-bold text-sm flex items-center gap-2 border-b border-border pb-2.5 mb-3">
              {isPublic ? (
                <Globe className="h-4 w-4 text-emerald-500" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              Plan Sharing Settings
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">Public Access Link</div>
                  <div className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                    Anyone with the link can view this plan.
                  </div>
                </div>
                <button
                  disabled={loading}
                  onClick={toggleShareStatus}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 ${
                    isPublic ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isPublic ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {isPublic && (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Copy Shared link
                  </div>
                  <div className="flex items-center gap-1.5 border border-border bg-muted/40 p-1.5 rounded-lg">
                    <input
                      type="text"
                      readOnly
                      value={getShareUrl()}
                      className="bg-transparent border-none outline-none text-[11px] text-muted-foreground font-mono flex-1 select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
