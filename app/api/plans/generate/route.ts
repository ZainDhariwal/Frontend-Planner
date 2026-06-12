import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { generateObjectWithFallback } from "@/lib/llm";
import { z } from "zod";

// Disable caching for API route
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Parse request payload
    const { brief, framework = "nextjs", settings = {}, provider = "gemini" } = await request.json();
    if (!brief || typeof brief !== "string" || brief.trim() === "") {
      return NextResponse.json({ error: "Product brief is required" }, { status: 400 });
    }

    // 3. Extract custom API Key if provided in headers
    const customApiKey = request.headers.get("x-api-key");

    // 4. Generate structured page tree using dynamic model failover chain
    const { object, cost: generatedCost } = await generateObjectWithFallback(
      provider,
      customApiKey,
      {
        schema: z.object({
          title: z.string().describe("A concise, professional name for the project plan (e.g. 'SaaS CRM Dashboard')"),
          briefSummary: z.string().describe("A clean 1-2 sentence architectural summary of the application requirements"),
          pages: z.array(
            z.object({
              name: z.string().describe("A clean descriptive name for the page route, e.g. 'Dashboard Summary', 'Invoice Details'"),
              path: z.string().describe("The URL path matching Next.js App Router conventions (e.g. '/dashboard', '/invoices', '/invoices/[id]')"),
              description: z.string().describe("Clear architectural purpose of the page, explaining what it outputs and what layout sections it requires")
            })
          ).min(1).max(50)
        }),
        system: `You are a Principal Frontend Architect. Your job is to decompose the user's vague product brief into a logical, highly structured list of page-level route nodes.
Ensure you follow professional web design conventions. Use clear paths (e.g., '/dashboard', '/settings', etc.).
Target Framework: ${framework}.
Plan settings: ${JSON.stringify(settings)}.`,
        prompt: `Analyze the following product brief and generate the initial page-level route tree:
---
${brief}
---`
      }
    );

    if (!object) {
      return NextResponse.json({ error: "Failed to generate initial page tree" }, { status: 500 });
    }

    // 6. Save plan to Supabase Database
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .insert({
        user_id: user.id,
        title: object.title,
        brief: brief,
        settings: { ...settings, framework, briefSummary: object.briefSummary },
        llm_provider: provider,
        total_cost: generatedCost
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Supabase plans insertion error:", planError);
      return NextResponse.json({ error: "Failed to create project plan in database" }, { status: 500 });
    }

    // 7. Save page nodes to public.plan_nodes
    const nodesToInsert = (object as any).pages.map((page: any) => ({
      plan_id: plan.id,
      type: "page",
      name: page.name,
      description: page.description,
      status: "draft",
      metadata: { path: page.path },
      version: 1
    }));

    const { data: nodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .insert(nodesToInsert)
      .select();

    if (nodesError || !nodes) {
      console.error("Supabase plan_nodes insertion error:", nodesError);
      // Clean up the plan to maintain consistency
      await supabase.from("plans").delete().eq("id", plan.id);
      return NextResponse.json({ error: "Failed to create plan route pages in database" }, { status: 500 });
    }

    // 8. Return response
    return NextResponse.json({
      success: true,
      plan,
      nodes,
      cost: generatedCost
    });

  } catch (err: any) {
    console.error("Plan generation handler crash:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during page tree generation." },
      { status: 500 }
    );
  }
}
