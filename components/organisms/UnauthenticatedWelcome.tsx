"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, FolderKanban, Network, Zap } from "lucide-react";

export default function UnauthenticatedWelcome() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Authentication error:", err);
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-black text-white relative overflow-hidden px-4 py-12 md:py-24">
      {/* Dynamic ambient background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Glassmorphic Wrapper */}
      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center border border-zinc-800 bg-zinc-950/45 backdrop-blur-2xl rounded-3xl p-8 md:p-16 shadow-2xl shadow-blue-500/5">
        
        {/* Sparkle Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 tracking-wider mb-8 uppercase animate-pulse">
          <Sparkles className="h-3 w-3" /> AI-Augmented Developer Tool
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent mb-6">
          Frontend Project Planner
        </h1>

        {/* Description */}
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed font-light">
          Decompose vague product briefs in plain English into interactive, drillable page-level trees, atomic components, custom hooks, and mock data shapes.
        </p>

        {/* Google OAuth Button */}
        <div className="w-full max-w-xs mb-16">
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-14 bg-white hover:bg-zinc-100 text-black font-semibold rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-white/5 cursor-pointer"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </>
            )}
          </Button>
          <p className="text-zinc-600 text-xs mt-3">
            Google authentication is required to save and version plans securely.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left border-t border-zinc-900 pt-12 w-full">
          <div className="p-4 rounded-xl border border-zinc-900/50 bg-zinc-950/20">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-4 border border-blue-500/20">
              <FolderKanban className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-2">Atomic Decomposition</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Generates clean layout hierarchies split logically into atomic components (atoms, molecules, organisms) for your codebase.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-900/50 bg-zinc-950/20">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-2">Lazy Expansion</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Drill down on-demand to create specific props, custom hooks, mock databases, and assets without bloating LLM budgets.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-900/50 bg-zinc-950/20">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 mb-4 border border-purple-500/20">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-2">Coherence Guard</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Automatically identifies invalid dependency mappings or missing hooks when components are modified or removed.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
