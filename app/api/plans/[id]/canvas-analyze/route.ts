import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { generateObjectWithFallback } from "@/lib/llm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Parse request payload
    const { pageId, layoutModel, provider = "gemini" } = await request.json();
    if (!pageId || !layoutModel) {
      return NextResponse.json({ error: "pageId and layoutModel are required" }, { status: 400 });
    }

    // 3. Fetch plan and page node details
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { data: pageNode, error: pageErr } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("id", pageId)
      .eq("type", "page")
      .single();

    if (pageErr || !pageNode) {
      return NextResponse.json({ error: "Page node not found" }, { status: 404 });
    }

    const framework = plan.settings?.framework || "nextjs";
    const customApiKey = request.headers.get("x-api-key");

    // 4. Prompt AI to analyze the structured layout layoutModel and return enriched specifications
    const { object: rawResponse, cost: generatedCost, usage, modelUsed, keyTypeUsed } = await generateObjectWithFallback(
      provider,
      customApiKey,
      {
        schema: z.object({
          components: z.array(
            z.object({
              id: z.string().describe("The temporary canvas node id passed in the request"),
              description: z.string().describe("Detailed functional responsibility of the component"),
              props: z.array(
                z.object({
                  name: z.string(),
                  type: z.string().describe("TypeScript type, e.g. string, boolean, (id: string) => void"),
                  description: z.string()
                })
              ).default([]),
              dependsOn: z.array(z.string()).describe("Names of hooks or data shapes this component relies on (e.g. ['useLeads', 'Lead'])")
            })
          ),
          hooks: z.array(
            z.object({
              name: z.string().describe("PascalCase custom hook or composable, e.g. useLeadsData, usePagination"),
              description: z.string().describe("State/behavior description"),
              inputs: z.string().describe("Input parameters with types"),
              outputs: z.string().describe("Output values/callbacks with types")
            })
          ).default([]),
          dataShapes: z.array(
            z.object({
              name: z.string().describe("TypeScript data interface name, e.g. Lead, User"),
              description: z.string(),
              tsInterface: z.string().describe("Multiline export interface definition")
            })
          ).default([]),
          contexts: z.array(
            z.object({
              name: z.string().describe("Context or Pinia/Svelte global store name"),
              description: z.string(),
              valueShape: z.string().describe("Data structure interface definition")
            })
          ).default([])
        }),
        system: `You are a Principal Frontend Architect. Your job is to analyze the user's visual canvas hierarchy and design a highly coherent architectural specification.
        
        Target Framework: ${
          framework === "vue" 
            ? "Vue (Nuxt Composition API & Pinia)" 
            : framework === "svelte" 
            ? "Svelte (SvelteKit Runes & writable stores)" 
            : framework === "react" 
            ? "React (SPA)" 
            : "Next.js (App Router)"
        }
        
        You will receive a list of component nodes laid out on the canvas, indicating their type (atom, molecule, organism) and nesting structure.
        
        Tasks:
        1. For each component node (using its ID as reference), generate a detailed description, complete TypeScript props interface, and state its dependencies.
        2. Identify any custom hooks (composables), global stores/contexts, or TypeScript interfaces (data shapes) required by these components to manage fetching, state, or mock data flow. Define their parameters, inputs, and output types.
        3. Make sure component properties match the UI specifications. Do not generate code implementation details.`,
        prompt: `Here is the structured layout model of components composed on the canvas:
        ${JSON.stringify(layoutModel, null, 2)}
        
        Analyze this structure and return the completed specifications object.`
      }
    );

    if (!rawResponse) {
      return NextResponse.json({ error: "Failed to analyze canvas layout" }, { status: 500 });
    }

    const response = rawResponse as any;
    const inputTokens = usage?.inputTokens ?? usage?.promptTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? usage?.completionTokens ?? 0;

    // 5. Update plan cost
    const { data: currentPlan } = await supabase.from("plans").select("total_cost").eq("id", planId).single();
    const currentCost = Number(currentPlan?.total_cost || 0);
    await supabase.from("plans").update({ total_cost: currentCost + generatedCost }).eq("id", planId);

    // 6. Save LLM usage log
    await supabase.from("llm_usage_logs").insert({
      plan_id: planId,
      node_id: pageId,
      model_name: modelUsed || provider,
      key_type: keyTypeUsed || "unknown",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: generatedCost,
      action_type: "decompose"
    });

    // 7. Update existing components in database with AI-generated details
    for (const comp of response.components) {
      // Find the component node to get its current metadata canvas properties
      const { data: currentComp } = await supabase
        .from("plan_nodes")
        .select("*")
        .eq("id", comp.id)
        .single();

      if (currentComp) {
        const currentMetadata = currentComp.metadata || {};
        await supabase
          .from("plan_nodes")
          .update({
            description: comp.description,
            metadata: {
              ...currentMetadata,
              props: comp.props
            },
            status: "accepted",
            updated_at: new Date().toISOString()
          })
          .eq("id", comp.id);
      }
    }

    // 8. Create newly identified helper nodes (hooks, contexts, data shapes) under this page
    const helperNodesToInsert: any[] = [];
    const helperNamesMap = new Map<string, string>(); // name -> database UUID

    response.hooks.forEach((hook: any) => {
      helperNodesToInsert.push({
        plan_id: planId,
        parent_id: pageId,
        type: "hook",
        name: hook.name,
        description: hook.description,
        status: "accepted",
        metadata: {
          inputs: hook.inputs,
          outputs: hook.outputs
        },
        version: 1
      });
    });

    response.dataShapes.forEach((shape: any) => {
      helperNodesToInsert.push({
        plan_id: planId,
        parent_id: pageId,
        type: "data_shape",
        name: shape.name,
        description: shape.description,
        status: "accepted",
        metadata: {
          tsInterface: shape.tsInterface
        },
        version: 1
      });
    });

    response.contexts.forEach((ctx: any) => {
      helperNodesToInsert.push({
        plan_id: planId,
        parent_id: pageId,
        type: "context",
        name: ctx.name,
        description: ctx.description,
        status: "accepted",
        metadata: {
          valueShape: ctx.valueShape
        },
        version: 1
      });
    });

    if (helperNodesToInsert.length > 0) {
      const { data: insertedHelpers, error: helperErr } = await supabase
        .from("plan_nodes")
        .insert(helperNodesToInsert)
        .select();

      if (!helperErr && insertedHelpers) {
        insertedHelpers.forEach(n => {
          helperNamesMap.set(n.name, n.id);
        });
      }
    }

    // 9. Establish dependencies (connections) between the components and the new helpers
    // First, clear old dependencies for this page
    await supabase.from("plan_node_dependencies").delete().eq("plan_id", planId);

    const dependenciesToInsert: any[] = [];

    for (const comp of response.components) {
      if (comp.dependsOn && comp.dependsOn.length > 0) {
        comp.dependsOn.forEach((depName: string) => {
          const targetId = helperNamesMap.get(depName);
          if (targetId) {
            // Check helper type to determine relationship category
            const { data: targetNode } = helperNamesMap.has(depName) 
              ? { data: { type: helperNodesToInsert.find(h => h.name === depName)?.type } }
              : { data: null };

            let depType = "references";
            if (targetNode?.type === "hook") depType = "uses_hook";
            else if (targetNode?.type === "context") depType = "uses_context";
            else if (targetNode?.type === "data_shape") depType = "uses_data_shape";

            dependenciesToInsert.push({
              plan_id: planId,
              source_node_id: comp.id,
              target_node_id: targetId,
              dependency_type: depType
            });
          }
        });
      }
    }

    if (dependenciesToInsert.length > 0) {
      await supabase.from("plan_node_dependencies").insert(dependenciesToInsert);
    }

    return NextResponse.json({
      success: true,
      message: "Canvas layout successfully analyzed and specifications enriched."
    });

  } catch (err: any) {
    console.error("Canvas analyze error:", err);
    return NextResponse.json({ error: err.message || "An unexpected error occurred." }, { status: 500 });
  }
}
