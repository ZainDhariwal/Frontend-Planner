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
    const { planId, nodeId, instruction, provider = "gemini" } = await request.json();
    if (!planId || !nodeId || !instruction) {
      return NextResponse.json({ error: "planId, nodeId, and instruction are required" }, { status: 400 });
    }

    // 3. Fetch current node details from database
    const { data: node, error: nodeError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("id", nodeId)
      .eq("plan_id", planId)
      .single();

    if (nodeError || !node) {
      return NextResponse.json({ error: "Plan node not found" }, { status: 404 });
    }

    // 4. Fetch sibling nodes for contextual coherence (same parent page)
    const { data: siblings } = await supabase
      .from("plan_nodes")
      .select("id, name, type, description")
      .eq("plan_id", planId)
      .eq("parent_id", node.parent_id || "")
      .neq("id", nodeId);

    // 5. Extract custom API Key if provided in headers
    const customApiKey = request.headers.get("x-api-key");

    // 6. Define dynamic system prompt and Zod schema depending on the node type
    let schema: any;
    let typeSpecificSystemPrompt = "";

    switch (node.type) {
      case "page":
        schema = z.object({
          name: z.string(),
          path: z.string(),
          description: z.string()
        });
        typeSpecificSystemPrompt = "You are updating a page route node. Define its name, URL path, and architectural description.";
        break;

      case "component":
        schema = z.object({
          name: z.string(),
          description: z.string(),
          atomicType: z.enum(["atom", "molecule", "organism"]),
          props: z.array(z.object({
            name: z.string(),
            type: z.string(),
            description: z.string()
          })),
          dependsOn: z.array(z.string()).default([])
        });
        typeSpecificSystemPrompt = "You are updating an atomic component node. Generate its name, props, atomicType, and in dependsOn specify dependencies on hooks/contexts.";
        break;

      case "hook":
        schema = z.object({
          name: z.string(),
          description: z.string(),
          inputs: z.string(),
          outputs: z.string(),
          dependsOn: z.array(z.string()).default([])
        });
        typeSpecificSystemPrompt = "You are updating a custom hook / composable. Define its input parameters, return values, and dependsOn entries.";
        break;

      case "context":
        schema = z.object({
          name: z.string(),
          description: z.string(),
          valueShape: z.string()
        });
        typeSpecificSystemPrompt = "You are updating a Context Provider / Pinia Store / Svelte Store. Generate its state interface shape and purpose.";
        break;

      case "data_shape":
        schema = z.object({
          name: z.string(),
          description: z.string(),
          tsInterface: z.string()
        });
        typeSpecificSystemPrompt = "You are updating a TypeScript interface data shape. Provide the full TypeScript interface syntax.";
        break;

      case "mock_data":
        schema = z.object({
          name: z.string(),
          jsonData: z.string(),
          dependsOn: z.string()
        });
        typeSpecificSystemPrompt = "You are updating a JSON Mock Data block. Ensure the jsonData output is standard stringified JSON array/object matching its type shape.";
        break;

      case "asset":
        schema = z.object({
          name: z.string(),
          type: z.enum(["icon", "illustration", "image"]),
          description: z.string()
        });
        typeSpecificSystemPrompt = "You are updating a static asset file descriptor.";
        break;

      case "lib":
        schema = z.object({
          name: z.string(),
          purpose: z.string()
        });
        typeSpecificSystemPrompt = "You are updating a third-party npm package dependency node.";
        break;

      default:
        return NextResponse.json({ error: "Unsupported node type for regeneration" }, { status: 400 });
    }

    const systemPrompt = `You are a Principal Frontend Architect. Your job is to regenerate and refine a specific node of type '${node.type}' inside a project planning tree.
The user is requesting updates to this node based on specific instructions.
Contextual sibling nodes under the same page: ${JSON.stringify(siblings || [])}.
${typeSpecificSystemPrompt}
Maintain consistency and avoid breaking matches with sibling names.`;

    const prompt = `Current Node Details:
- Name: ${node.name}
- Type: ${node.type}
- Description: ${node.description}
- Metadata: ${JSON.stringify(node.metadata)}

Regeneration Instruction:
"${instruction}"

Output the updated node properties conforming to the schema.`;

    // 7. Call LLM using model failover chain
    const { object, cost: generatedCost, usage, modelUsed, keyTypeUsed } = await generateObjectWithFallback(
      provider,
      customApiKey,
      {
        schema,
        system: systemPrompt,
        prompt
      }
    );

    if (!object) {
      return NextResponse.json({ error: "Failed to regenerate node properties" }, { status: 500 });
    }

    // 8. Update cost in Supabase
    const { error: costError } = await supabase.rpc("increment_plan_cost", {
      p_plan_id: planId,
      p_cost_increment: generatedCost
    });

    if (costError) {
      const { data: currentPlan } = await supabase.from("plans").select("total_cost").eq("id", planId).single();
      const currentCost = Number(currentPlan?.total_cost || 0);
      await supabase.from("plans").update({ total_cost: currentCost + generatedCost }).eq("id", planId);
    }

    // 8.5 Save LLM Usage Log
    await supabase.from("llm_usage_logs").insert({
      plan_id: planId,
      node_id: nodeId,
      model_name: modelUsed || provider,
      key_type: keyTypeUsed || "unknown",
      input_tokens: usage?.inputTokens ?? usage?.promptTokens ?? 0,
      output_tokens: usage?.outputTokens ?? usage?.completionTokens ?? 0,
      cost: generatedCost,
      action_type: "regenerate"
    });

    // 9. Format metadata based on node type
    let metadata: any = {};
    if (node.type === "page") {
      metadata = { path: (object as any).path };
    } else if (node.type === "component") {
      metadata = {
        atomicType: (object as any).atomicType,
        props: (object as any).props,
        dependsOn: (object as any).dependsOn
      };
    } else if (node.type === "hook") {
      metadata = {
        inputs: (object as any).inputs,
        outputs: (object as any).outputs,
        dependsOn: (object as any).dependsOn
      };
    } else if (node.type === "context") {
      metadata = { valueShape: (object as any).valueShape };
    } else if (node.type === "data_shape") {
      metadata = { tsInterface: (object as any).tsInterface };
    } else if (node.type === "mock_data") {
      metadata = { jsonData: (object as any).jsonData, dependsOn: (object as any).dependsOn };
    } else if (node.type === "asset") {
      metadata = { assetType: (object as any).type };
    }

    // 10. Save changes and increment version
    const nextVersion = (node.version || 1) + 1;
    const { data: updatedNode, error: updateError } = await supabase
      .from("plan_nodes")
      .update({
        name: (object as any).name,
        description: (object as any).description || node.description,
        metadata,
        version: nextVersion,
        updated_at: new Date().toISOString()
      })
      .eq("id", nodeId)
      .select()
      .single();

    if (updateError || !updatedNode) {
      console.error("Supabase node update error:", updateError);
      return NextResponse.json({ error: "Failed to save updated node in database" }, { status: 500 });
    }

    // 11. Update dependencies in Supabase for components/hooks/mocks if metadata changed
    if (["component", "hook", "mock_data"].includes(node.type)) {
      // Clear old dependencies for this source node
      await supabase.from("plan_node_dependencies").delete().eq("source_node_id", nodeId);

      const dependenciesToInsert: any[] = [];
      const dependsOn: string[] = (object as any).dependsOn || [];
      const dependsOnMock: string = (object as any).dependsOn || "";

      // Lookup target names in the active sibling scope
      const { data: activeNodes } = await supabase
        .from("plan_nodes")
        .select("id, name, type")
        .eq("plan_id", planId)
        .eq("parent_id", node.parent_id || "");

      if (activeNodes && activeNodes.length > 0) {
        const nameToIdMap = new Map<string, { id: string; type: string }>();
        activeNodes.forEach((n) => nameToIdMap.set(n.name, { id: n.id, type: n.type }));

        if (node.type === "mock_data" && dependsOnMock) {
          const target = nameToIdMap.get(dependsOnMock);
          if (target) {
            dependenciesToInsert.push({
              plan_id: planId,
              source_node_id: nodeId,
              target_node_id: target.id,
              dependency_type: "uses_data_shape"
            });
          }
        } else {
          dependsOn.forEach((depName) => {
            const target = nameToIdMap.get(depName);
            if (target) {
              let depType = "references";
              if (target.type === "component") depType = "uses_component";
              else if (target.type === "hook") depType = "uses_hook";
              else if (target.type === "context") depType = "uses_context";
              else if (target.type === "data_shape") depType = "uses_data_shape";

              dependenciesToInsert.push({
                plan_id: planId,
                source_node_id: nodeId,
                target_node_id: target.id,
                dependency_type: depType
              });
            }
          });
        }
      }

      if (dependenciesToInsert.length > 0) {
        await supabase.from("plan_node_dependencies").insert(dependenciesToInsert);
      }
    }

    return NextResponse.json({
      success: true,
      node: updatedNode,
      cost: generatedCost
    });

  } catch (err: any) {
    console.error("Node regeneration handler crash:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during node regeneration." },
      { status: 500 }
    );
  }
}
