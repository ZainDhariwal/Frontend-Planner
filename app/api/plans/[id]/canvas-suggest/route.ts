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
    const { pageId, provider = "gemini" } = await request.json();
    if (!pageId) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    // 3. Fetch plan and active page node details
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

    // 4. Prompt AI to suggest visual layout wireframe elements
    const { object, cost: generatedCost, usage, modelUsed, keyTypeUsed } = await generateObjectWithFallback(
      provider,
      customApiKey,
      {
        schema: z.object({
          components: z.array(
            z.object({
              name: z.string().describe("Clean PascalCase component name, e.g. UserTable, PrimaryButton, MainHeader"),
              type: z.enum(["atom", "molecule", "organism"]).describe("Component categorization"),
              description: z.string().describe("What this visual element presents"),
              canvas: z.object({
                x: z.number().describe("Coordinate x on a 1200px viewport"),
                y: z.number().describe("Coordinate y on an 800px viewport"),
                width: z.number().describe("Suggested width in pixels"),
                height: z.number().describe("Suggested height in pixels")
              })
            })
          ).min(3).max(15)
        }),
        system: `You are a Principal Frontend Architect. Your job is to suggest a wireframe dashboard/page layout of components for the page route '${pageNode.name}' (path: '${pageNode.metadata?.path || "/"}', description: '${pageNode.description || ""}').
        
        Suggest typical components required to compose this page layout based on standard web application design practices.
        
        Layout Coordinates Guideline:
        - Viewport boundary is roughly 0 to 1200 on X-axis, and 0 to 800 on Y-axis.
        - Arrange sections/organisms first (e.g. Header, Sidebar, MainPanel) to define outer structures.
        - Place inner components (molecules or atoms) inside those outer containers geometrically so that containment calculations can determine their parent-child hierarchy.
        - Ensure child coordinates fit entirely within their parent containers. E.g., if a MainPanel is at (x: 250, y: 80, w: 900, h: 700), any tables or cards nested inside it must be placed within x: [260, 1140] and y: [90, 770].
        - Use standard PascalCase names (e.g. ActivityChart, SearchBar, ProfilePanel).`,
        prompt: `Provide visual element layout suggestions for the page route: ${pageNode.name}.`
      }
    );

    if (!object || !object.components) {
      return NextResponse.json({ error: "Failed to generate layout suggestions" }, { status: 500 });
    }

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
      action_type: "decompose" // Treated as a form of layout decomposition
    });

    // 7. Bulk insert generated components
    // Clear any existing components under this page first to refresh
    await supabase.from("plan_nodes").delete().eq("parent_id", pageId);

    const nodesToInsert = object.components.map((c: any) => ({
      plan_id: planId,
      parent_id: pageId, // All suggested components will initially sit under the page
      type: "component",
      name: c.name,
      description: c.description,
      status: "draft",
      metadata: {
        atomicType: c.type,
        canvas: {
          x: c.canvas.x,
          y: c.canvas.y,
          width: c.canvas.width,
          height: c.canvas.height,
          zIndex: 1,
          collapsed: false
        }
      },
      version: 1
    }));

    const { data: insertedNodes, error: insertErr } = await supabase
      .from("plan_nodes")
      .insert(nodesToInsert)
      .select();

    if (insertErr || !insertedNodes) {
      console.error("Error inserting layout suggestions:", insertErr);
      return NextResponse.json({ error: "Failed to save layout suggestions to database" }, { status: 500 });
    }

    // 8. Apply deterministic parenting calculations on the server before returning
    // This establishes nesting hierarchy immediately if coordinates are nested.
    const nodesMap = new Map<string, any>(insertedNodes.map(n => [n.id, n]));
    const updatedNodes: any[] = [];

    for (const node of insertedNodes) {
      const nodeX = node.metadata?.canvas?.x ?? 0;
      const nodeY = node.metadata?.canvas?.y ?? 0;
      const nodeW = node.metadata?.canvas?.width ?? 0;
      const nodeH = node.metadata?.canvas?.height ?? 0;

      let parentId: string | null = pageId; // Default to top level page
      let smallestParentArea = Infinity;

      for (const otherNode of insertedNodes) {
        if (otherNode.id === node.id) continue;
        // Check only container types (organisms) to avoid nesting inside atoms
        if (otherNode.metadata?.atomicType !== "organism") continue;

        const otherX = otherNode.metadata?.canvas?.x ?? 0;
        const otherY = otherNode.metadata?.canvas?.y ?? 0;
        const otherW = otherNode.metadata?.canvas?.width ?? 0;
        const otherH = otherNode.metadata?.canvas?.height ?? 0;

        // Containment check
        const isContained = 
          nodeX >= otherX &&
          nodeY >= otherY &&
          (nodeX + nodeW) <= (otherX + otherW) &&
          (nodeY + nodeH) <= (otherY + otherH);

        if (isContained) {
          const area = otherW * otherH;
          if (area < smallestParentArea) {
            smallestParentArea = area;
            parentId = otherNode.id;
          }
        }
      }

      if (parentId !== pageId) {
        // Update local memory and push DB change
        node.parent_id = parentId;
        await supabase.from("plan_nodes").update({ parent_id: parentId }).eq("id", node.id);
      }
      updatedNodes.push(node);
    }

    return NextResponse.json({
      success: true,
      nodes: updatedNodes
    });

  } catch (err: any) {
    console.error("Layout suggestion error:", err);
    return NextResponse.json({ error: err.message || "An unexpected error occurred." }, { status: 500 });
  }
}
