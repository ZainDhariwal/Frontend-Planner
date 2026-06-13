import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { generateObjectWithFallback } from "@/lib/llm";
import { z } from "zod";

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
    let { planId, nodeId, nodeName, nodePath, nodeDescription, framework = "nextjs", provider = "gemini", instruction } = await request.json();
    if (!planId || !nodeId) {
      return NextResponse.json({ error: "planId and nodeId are required parameters" }, { status: 400 });
    }

    // If node parameters are missing, query them from the database
    if (!nodeName) {
      const { data: dbNode, error: nodeQueryError } = await supabase
        .from("plan_nodes")
        .select("*")
        .eq("id", nodeId)
        .single();
      
      if (nodeQueryError || !dbNode) {
        return NextResponse.json({ error: "Could not retrieve the target page node from the database" }, { status: 400 });
      }
      nodeName = dbNode.name;
      nodePath = dbNode.metadata?.path || "";
      nodeDescription = dbNode.description || "";
    }

    // 3. Extract custom API Key if provided in headers
    const customApiKey = request.headers.get("x-api-key");

    // 4. Generate structured child nodes using model failover chain
    const { object: rawObject, cost: generatedCost, usage, modelUsed, keyTypeUsed } = await generateObjectWithFallback(
      provider,
      customApiKey,
      {
        schema: z.object({
          components: z.array(
            z.object({
              name: z.string().describe("Clean PascalCase component name, e.g., 'TicketTable', 'SearchInput'"),
              description: z.string().describe("What the component displays and its visual states"),
              atomicType: z.enum(["atom", "molecule", "organism"]).describe("atoms are basic primitives, molecules combine atoms, organisms represent complex self-contained features"),
              props: z.array(z.object({
                name: z.string(),
                type: z.string().describe("TypeScript type (string, number, function callback, etc.)"),
                description: z.string()
              })),
              dependsOn: z.array(z.string()).describe("List names of other components, hooks, or contexts created in this response that this component directly calls/uses")
            })
          ).default([]),
          hooks: z.array(
            z.object({
              name: z.string().describe("Standard react custom hook or Vue composable name starting with 'use', e.g. 'useTickets', 'useFilter'"),
              description: z.string().describe("What logic the hook handles (e.g. pagination, fetching tickets, local state)"),
              inputs: z.string().describe("Parameters representing inputs to the hook with types"),
              outputs: z.string().describe("Deconstructed returned values/functions with types"),
              dependsOn: z.array(z.string()).describe("List names of contexts or data shapes generated in this response that this hook uses")
            })
          ).default([]),
          contexts: z.array(
            z.object({
              name: z.string().describe("Context provider or global store name, e.g., 'AuthContext', 'useTicketStore'"),
              description: z.string().describe("State stored in the context/store and why it is scoped globally/locally"),
              valueShape: z.string().describe("TypeScript interface/shape of the store or context value")
            })
          ).default([]),
          dataShapes: z.array(
            z.object({
              name: z.string().describe("Standard TypeScript interface name, e.g. 'Ticket', 'Customer'"),
              description: z.string().describe("Entity it represents"),
              tsInterface: z.string().describe("Raw multiline TypeScript export interface string defining fields and types")
            })
          ).default([]),
          mockData: z.array(
            z.object({
              name: z.string().describe("Mock data array identifier, e.g. 'mockTickets', 'mockCustomers'"),
              jsonData: z.string().describe("Valid JSON string containing an array of 2-3 realistic mock objects matching the data shape"),
              dependsOn: z.string().describe("Name of the TypeScript dataShape interface this mock data conforms to")
            })
          ).default([]),
          assets: z.array(
            z.object({
              name: z.string().describe("Descriptive asset reference, e.g. 'plus-icon', 'empty-dashboard-illustration'"),
              type: z.enum(["icon", "illustration", "image"]),
              description: z.string().describe("Purpose and visual details of the asset")
            })
          ).default([]),
          libs: z.array(
            z.object({
              name: z.string().describe("npm package name, e.g., 'recharts', 'date-fns'"),
              purpose: z.string().describe("Why this package is needed for this specific page")
            })
          ).default([])
        }),
        system: `You are a Principal Frontend Architect. Your job is to decompose the page node '${nodeName}' (path: '${nodePath}', description: '${nodeDescription}') into its required children elements.
${
  framework === "vue"
    ? `Target Framework: Vue (Nuxt / Atomic).
Decompose it into:
- Components (Vue single-file components (.vue) using script setup syntax <script setup lang="ts"> and Tailwind CSS, structured as atoms, molecules, or organisms)
- Hooks (Custom composables e.g. 'useTickets.ts' handling local/reactive state)
- Contexts (Pinia stores e.g. 'useTicketStore.ts' or Vue provide/inject for global state)`
    : framework === "svelte"
    ? `Target Framework: Svelte (SvelteKit / Atomic).
Decompose it into:
- Components (Svelte components (.svelte) using Svelte 5 Runes ($state, $derived, $props) or Svelte stores and Tailwind CSS, structured as atoms, molecules, or organisms)
- Hooks (Svelte helper/composable functions)
- Contexts (Svelte writable stores or context modules using setContext/getContext)`
    : `Target Framework: ${framework === "react" ? "React (SPA)" : "Next.js (App Router)"}.
Decompose it into:
- Components (React components structured as atoms, molecules, or organisms using Tailwind CSS)
- Hooks (React custom hooks starting with 'use')
- Contexts (React Context providers ending with 'Context')`
}
Also extract the required data shapes (TypeScript interfaces), mock data (conforming JSON), assets, and libraries.
Be precise, highly technical, and production-ready. Ensure dependsOn values match the names of items generated.`,
        prompt: `Decompose the page node '${nodeName}' into its structural details and dependencies.${
          instruction && instruction.trim() !== ""
            ? `\nImplement the following custom requirements: ${instruction}`
            : ""
        }`
      }
    );

    if (!rawObject) {
      return NextResponse.json({ error: "Failed to decompose page structure" }, { status: 500 });
    }

    const object = rawObject as any;

    // Clear any existing child nodes (and their cascading dependencies)
    const { error: deleteError } = await supabase
      .from("plan_nodes")
      .delete()
      .eq("parent_id", nodeId);

    if (deleteError) {
      console.error("Supabase children deletion error:", deleteError);
      return NextResponse.json({ error: "Failed to clear previous child elements in database" }, { status: 500 });
    }

    // 5. Update plan cost in plans table
    const { error: costError } = await supabase.rpc("increment_plan_cost", {
      p_plan_id: planId,
      p_cost_increment: generatedCost
    });

    // Fallback if rpc is not created yet (increment directly)
    if (costError) {
      const { data: currentPlan } = await supabase.from("plans").select("total_cost").eq("id", planId).single();
      const currentCost = Number(currentPlan?.total_cost || 0);
      await supabase.from("plans").update({ total_cost: currentCost + generatedCost }).eq("id", planId);
    }

    // 5.5 Save LLM Usage Log
    await supabase.from("llm_usage_logs").insert({
      plan_id: planId,
      node_id: nodeId,
      model_name: modelUsed || provider,
      key_type: keyTypeUsed || "unknown",
      input_tokens: usage?.inputTokens ?? usage?.promptTokens ?? 0,
      output_tokens: usage?.outputTokens ?? usage?.completionTokens ?? 0,
      cost: generatedCost,
      action_type: "decompose"
    });

    // 6. Bulk prepare plan nodes to insert
    const nodesToInsert: any[] = [];

    // Map each category to database node insert objects
    object.components.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "component",
        name: item.name,
        description: item.description,
        status: "draft",
        metadata: { atomicType: item.atomicType, props: item.props, dependsOn: item.dependsOn },
        version: 1
      });
    });

    object.hooks.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "hook",
        name: item.name,
        description: item.description,
        status: "draft",
        metadata: { inputs: item.inputs, outputs: item.outputs, dependsOn: item.dependsOn },
        version: 1
      });
    });

    object.contexts.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "context",
        name: item.name,
        description: item.description,
        status: "draft",
        metadata: { valueShape: item.valueShape },
        version: 1
      });
    });

    object.dataShapes.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "data_shape",
        name: item.name,
        description: item.description,
        status: "draft",
        metadata: { tsInterface: item.tsInterface },
        version: 1
      });
    });

    object.mockData.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "mock_data",
        name: item.name,
        description: `Mock data for ${item.dependsOn}`,
        status: "draft",
        metadata: { jsonData: item.jsonData, dependsOn: item.dependsOn },
        version: 1
      });
    });

    object.assets.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "asset",
        name: item.name,
        description: item.description,
        status: "draft",
        metadata: { assetType: item.type },
        version: 1
      });
    });

    object.libs.forEach((item: any) => {
      nodesToInsert.push({
        plan_id: planId,
        parent_id: nodeId,
        type: "lib",
        name: item.name,
        description: item.purpose,
        status: "draft",
        metadata: {},
        version: 1
      });
    });

    if (nodesToInsert.length === 0) {
      return NextResponse.json({ success: true, nodes: [], dependencies: [], cost: generatedCost });
    }

    // Insert nodes to database
    const { data: dbNodes, error: insertError } = await supabase
      .from("plan_nodes")
      .insert(nodesToInsert)
      .select();

    if (insertError || !dbNodes) {
      console.error("Supabase children insertion error:", insertError);
      return NextResponse.json({ error: "Failed to insert child elements into database" }, { status: 500 });
    }

    // 7. Resolve in-memory dependencies and insert to plan_node_dependencies
    const nameToIdMap = new Map<string, string>();
    dbNodes.forEach((node: any) => {
      nameToIdMap.set(node.name, node.id);
    });

    const dependenciesToInsert: any[] = [];

    // Parse component dependencies
    object.components.forEach((item: any) => {
      const sourceId = nameToIdMap.get(item.name);
      if (sourceId && item.dependsOn) {
        item.dependsOn.forEach((depName: any) => {
          const targetId = nameToIdMap.get(depName);
          if (targetId) {
            const targetNode = dbNodes.find((n: any) => n.id === targetId);
            let depType = "references";
            if (targetNode?.type === "component") depType = "uses_component";
            else if (targetNode?.type === "hook") depType = "uses_hook";
            else if (targetNode?.type === "context") depType = "uses_context";
            else if (targetNode?.type === "data_shape") depType = "uses_data_shape";

            dependenciesToInsert.push({
              plan_id: planId,
              source_node_id: sourceId,
              target_node_id: targetId,
              dependency_type: depType
            });
          }
        });
      }
    });

    // Parse hook dependencies
    object.hooks.forEach((item: any) => {
      const sourceId = nameToIdMap.get(item.name);
      if (sourceId && item.dependsOn) {
        item.dependsOn.forEach((depName: any) => {
          const targetId = nameToIdMap.get(depName);
          if (targetId) {
            const targetNode = dbNodes.find((n: any) => n.id === targetId);
            let depType = "references";
            if (targetNode?.type === "context") depType = "uses_context";
            else if (targetNode?.type === "data_shape") depType = "uses_data_shape";

            dependenciesToInsert.push({
              plan_id: planId,
              source_node_id: sourceId,
              target_node_id: targetId,
              dependency_type: depType
            });
          }
        });
      }
    });

    // Parse mockData dependencies
    object.mockData.forEach((item: any) => {
      const sourceId = nameToIdMap.get(item.name);
      if (sourceId && item.dependsOn) {
        const targetId = nameToIdMap.get(item.dependsOn);
        if (targetId) {
          dependenciesToInsert.push({
            plan_id: planId,
            source_node_id: sourceId,
            target_node_id: targetId,
            dependency_type: "uses_data_shape"
          });
        }
      }
    });

    let dbDependencies: any[] = [];
    if (dependenciesToInsert.length > 0) {
      const { data: deps, error: depsError } = await supabase
        .from("plan_node_dependencies")
        .insert(dependenciesToInsert)
        .select();
      
      if (depsError) {
        console.error("Supabase plan_node_dependencies insertion error:", depsError);
      } else {
        dbDependencies = deps || [];
      }
    }

    return NextResponse.json({
      success: true,
      nodes: dbNodes,
      dependencies: dbDependencies,
      cost: generatedCost
    });

  } catch (err: any) {
    console.error("Page decomposition handler crash:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during page decomposition." },
      { status: 500 }
    );
  }
}
