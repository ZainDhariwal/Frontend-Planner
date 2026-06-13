# Walkthrough - Frontend Project Planner

This walkthrough documents the step-by-step build progress and verification details of the planner application.

---

## Phase 1: Next.js & UI Scaffolding (Completed)

We initialized the project structure using Next.js (App Router), Tailwind CSS, and TypeScript:
- Cleared the workspace directory.
- Bootstrapped the Next.js project.
- Configured **shadcn/ui** with custom Tailwind CSS v4 support.
- Configured local custom variables in `app/globals.css` to enable premium glassmorphism themes.

---

## Phase 2: Database Schema & Supabase Auth (Completed)

We established the data model and authentication layers:
- Created the SQL migration file: [20260610000000_init.sql](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/supabase/migrations/20260610000000_init.sql)
  - Tables defined: `profiles`, `plans`, `plan_nodes`, and `plan_node_dependencies`.
  - Added triggers to sync newly signed-up auth users to the public `profiles` table.
  - Configured strict Row Level Security (RLS) policies to isolate plans by owner.
- Configured local environment variables: [.env.local](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/.env.local) with Supabase parameters.
- Built helper functions for server, client, and middleware Supabase client factories under `utils/supabase/`.
- Integrated a global routing proxy in [proxy.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/proxy.ts) (replacing the deprecated `middleware.ts` to fix Next.js 16 build warnings) to keep user sessions refreshed on the server side.
- Created the OAuth redirect receiver route: [route.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/app/auth/callback/route.ts).
- Designed the entry-point page [page.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/app/page.tsx) to conditionally render:
  - An unauthenticated welcome dashboard with a Google sign-in trigger: [UnauthenticatedWelcome.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/UnauthenticatedWelcome.tsx)
  - An authenticated workspace container: [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx)

---

## Phase 3: LLM Layer, Orchestration & Failover (Completed)

We established the AI generation endpoints and implemented robust failover logic:
- Installed `ai` (Vercel AI SDK Core), `@ai-sdk/google`, and `@ai-sdk/anthropic` provider libraries.
- Wrote [lib/llm.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/lib/llm.ts) to handle dynamic client configuration and model failovers.
- **Failover & Paid/Free Key Logic**:
  - Implemented automatic key and model level failover in `generateObjectWithFallback`.
  - When calling Gemini (or Anthropic):
    1. First tries the user's custom API key (paid key) with the highest model (`gemini-2.5-pro` or `claude-3-5-sonnet`).
    2. If that fails (quota, rate-limit, billing), tries the custom key with the lower model (`gemini-2.5-flash` or `claude-3-5-haiku`).
    3. If that fails (or key is fully exhausted/invalid), falls back to the system's default API key (free tier) and tries the highest model.
    4. Finally, falls back to the system's default key with the lower model.
- Fixed TypeScript compilation errors across the routes to ensure standard build validation passes.

---

## Phase 4: Dashboard & Tree UI Components (Completed)

We successfully constructed the entire workspace application interface:
- **Installed Packages**: Installed `jszip` and `@types/jszip` to build zip archives directly in the browser.
- **Atom Components**:
  - [Spinner.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/atoms/Spinner.tsx): Glassmorphic loading spinners.
  - [Badge.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/atoms/Badge.tsx): Custom status pill indicators.
  - [NodeIcon.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/atoms/NodeIcon.tsx): Multi-colored icon mappings for page nodes and system elements.
- **Molecule Components**:
  - [CostIndicator.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/molecules/CostIndicator.tsx): Real-time token usage and monetary cost tracker.
  - [ExportDropdown.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/molecules/ExportDropdown.tsx): Allows downloading the generated planner details as Markdown report files, raw JSON schemas, or compiles a fully scaffolded directory structure into a downloadable ZIP archive containing standard file structures.
- **Organism Components**:
  - [Navbar.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/Navbar.tsx): Responsive top navigation bar.
  - [SettingsModal.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/SettingsModal.tsx): Frosted card modal to input custom Gemini / Anthropic API keys (persisted in local storage).
  - [PlanTreeView.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/PlanTreeView.tsx): Navigable tree hierarchy that lists page nodes and handles on-demand, lazy decomposition clicks.
  - [NodeEditor.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/NodeEditor.tsx): Active node property editor, AI regeneration console, and copy-pasteable Cursor/Claude Code prompt generator.
  - [CoherencePanel.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/CoherencePanel.tsx): Dependency validation checker highlighting circular dependencies or broken targets.
  - [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx): Root layout grid coordinating sidebars, tree states, loading overlays, and database fetches.

---

## Phase 5: Quota Exceeded Graceful Handling & Fallback Modal (Completed)

To prevent application crashes and improve user experience when users hit Gemini's API rate limits or quota caps:
- **Rate Limit Interception**: Modified `/api/plans/generate`, `/api/plans/decompose`, and `/api/plans/regenerate` fetch layers to detect `429` (Quota Exceeded / Rate Limit) error conditions.
- **Glassmorphic Quota Fallback Modal**:
  - Implemented custom state-based confirmation overlays in both [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx) and [NodeEditor.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/NodeEditor.tsx).
  - When a user's custom API key runs out of quota, they are presented with a confirmation modal asking if they want to fallback to the system's default key.
  - If approved, the client retries the request without transmitting the custom `x-api-key` header, seamlessly falling back to the server-side `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` default key (free version).
- **Cost Calculation Exclusion for Free Fallback**:
  - Updated the orchestrator in [lib/llm.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/lib/llm.ts) to check the type of key utilized (`attempt.keyType`).
  - If a request is handled by the system's default API key (the free system fallback), the estimated cost returned is explicitly set to `0` so the user is not shown a simulated monetary charge for free API calls.
- **Copy AI Master Prompt Feature**:
  - Added a new **"Copy AI Master Prompt"** action inside [ExportDropdown.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/molecules/ExportDropdown.tsx).
  - This compiles the entire project plan (including all route paths, decomposed component structures, TypeScript schemas, custom hooks input/output models, mock data objects, third-party libraries, and detailed step-by-step sequence instructions) into a single master prompt.
  - Copies it to the clipboard to instantly bootstrap or scaffold the entire codebase in Cursor, Claude Code, or any coding agent in one go.
- **API Prompt Validation Fix**:
  - Resolved a validation error (`Invalid prompt: prompt or messages must be defined`) in [route.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/app/api/plans/generate/route.ts).
  - Moved the user product brief into the designated `prompt` field (as required by the Vercel AI SDK) while leaving the system instructions, layout policies, and Zod output constraints inside the `system` parameter.
  - Aligned system instructions to query `name` instead of `title` for each page route to strictly match the underlying Zod validation schema.

---

## Phase 6: Settings Theme-Awareness & Sidebar Contrast Polish (Completed)

To address readability concerns in light theme and improve sidebar text sizes:
- **Theme-Aware Settings Modal**:
  - Refactored [SettingsModal.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/SettingsModal.tsx). Replaced hardcoded zinc dark backgrounds (`bg-zinc-950/90`) and borders (`border-zinc-800`) with semantic theme-aware Tailwind classes (`bg-card/90`, `border-border`, `text-foreground`).
  - Settings panel inputs, provider selection buttons, and labels now dynamically adapt to light mode beautifully.
- **Sidebar Readability Enhancement**:
  - Refactored the left panel plan list inside [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx).
  - Enlarged the project titles (`text-sm font-bold`) and adjusted their colors to support robust contrast in both themes.
  - Increased the description font sizes (`text-xs`) and dark/light contrast (`text-zinc-600 dark:text-zinc-400 font-semibold`) for immediate readability.
  - Sized up and adjusted target framework labels and cost indicators (`text-[11px] font-bold`).
- **Live Demo Reference**:
  - Updated [README.md](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/README.md) to add the active Vercel deployment link: `https://frontend-planner-one.vercel.app/`.

---

## Phase 7: Advanced Collaborative & Analytics Features (Completed)

To transform the planner into an enterprise-ready collaborative product:
- **Shareable Read-Only Workspace Links**:
  - Implemented the `is_public` column toggle via a glassmorphic client-side popover component: [ShareButton.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/molecules/ShareButton.tsx).
  - Created the dynamic router page: [page.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/app/shared/[id]/page.tsx). It uses row-level security policies to retrieve plan schemas anonymously, offering a read-only workspace layout featuring tree inspection, coherence validation, and boilerplate code ZIP or master prompt exports.
  - Updated [PlanTreeView.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/PlanTreeView.tsx) to hide modification buttons when rendered in readOnly mode.
- **Undo / Redo Workspace History**:
  - Added session history stacks (`undoStack`, `redoStack`) in [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx).
  - Listened to keyboard shortcut bindings (`Cmd+Z`, `Cmd+Y`, `Cmd+Shift+Z`) to trigger state reversions instantly.
  - Implemented database synchronization logic (`syncStateToDatabase`) to automatically align deletions and updates back to Supabase.
- **Visual LLM Cost & Token Usage Dashboard**:
  - Refactored `/api/plans` endpoints to record LLM request usage metadata into the new `llm_usage_logs` table.
  - Built the dashboard overlay [CostDashboardModal.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/CostDashboardModal.tsx) showcasing cumulative expenditures, tokens-per-minute efficiency meters, custom-vs-system key ratios, pricing share by models, and detailed historical logs with dynamic search.
- **Vue & Svelte Atomic Layouts Support**:
  - Added Vue Nuxt Composition API and Svelte SvelteKit Runes configurations inside the plan creator form, system generation prompts, boilerplate generator, ZIP exports, and Master Prompt compilers.
- **Fine-Grained Cost Precision**:
  - Updated `total_cost` definitions to `numeric(15, 6)` in the schema to support micro-cost calculations and recorded non-zero log details for all system key fallbacks.
- **Database Schema Migration**:
  - Modified the main migration script [20260610000000_init.sql](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/supabase/migrations/20260610000000_init.sql) to include the schema updates directly (preserving a single, clean database init file).

---

## Phase 8: History & Usage RLS Bugfixes (Completed)

To fix UI delays and dashboard cost tracking issues:
- **Snappy Debounced Undo/Redo**:
  - Introduced `syncTimerRef` and `pendingSyncRef` inside [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx).
  - Modified `handleUndo` and `handleRedo` to trigger state updates instantly and reset the active page decomposition loaders (`decomposingMap = {}`) to cancel ongoing spinner states.
  - Implemented background database synchronization (`queueDatabaseSync`) debounced by `600ms` to prevent database write blocks and serial race conditions.
- **Resolved Zero-Cost Dashboard Bug**:
  - Discovered and fixed the missing RLS `INSERT` policy on the `llm_usage_logs` table in [20260610000000_init.sql](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/supabase/migrations/20260610000000_init.sql). This policy now allows authorized plan owners to successfully log LLM queries.
  - Modified [lib/llm.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/lib/llm.ts) to defensively extract `inputTokens`/`promptTokens` and `outputTokens`/`completionTokens` keys from the SDK response and added console debug outputs.
  - Updated usage insertions across `/api/plans/generate`, `/api/plans/decompose`, and `/api/plans/regenerate` routes to safely fetch token metrics.

---

## Phase 9: Visual Wireframe Canvas (Completed)

To introduce architectural wireframing capabilities:
- **Interactive Drag-and-Drop Canvas Workspace**:
  - Structured modular folder [components/canvas](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas) containing:
    - [VisualCanvas.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/VisualCanvas.tsx): Root layout orchestrator linking sidebar, toolbar, grid, and editor panel.
    - [CanvasBoard.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasBoard.tsx): Drag/resize event handlers, zoom/pan transforms, and geometry checks.
    - [CanvasGrid.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasGrid.tsx): Radial dot infinite background.
    - [CanvasNode.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasNode.tsx): Component rendering cards with inline double-click rename input.
    - [CanvasSidebar.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasSidebar.tsx): Drag templates palette containing Atoms, Molecules, and Organisms.
    - [CanvasToolbar.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasToolbar.tsx): Floating overlays for zoom, fits, and AI requests triggers.
    - [CanvasResizeHandle.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasResizeHandle.tsx): Custom border resize handles.
    - [CanvasSelection.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasSelection.tsx): Highlighting selection frames and pixel sizing metric badges.
    - [CanvasMinimap.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasMinimap.tsx): Panning offset metrics coordinates widget.
- **Deterministic Geometric containment**:
  - Implemented client-side bounding box containment logic. Dropping a child inside a container or section organism automatically updates the child's `parent_id` in the database and re-renders the workspace state instantly.
- **AI Backend API Integration**:
  - Created `/api/plans/[id]/canvas-suggest` endpoint to generate layout suggestions using LLM coordinate maps, allowing immediate automated scaffolding on the canvas.
  - Created `/api/plans/[id]/canvas-analyze` endpoint to receive layout hierarchy mappings, letting the AI generate TypeScript component props interfaces, custom hooks, and mock data dependencies.
- **Shared Workspace Canvas**:
  - Integrated full canvas viewing controls (zoom, pan, active node inspection) into public shared workspaces in [app/shared/[id]/page.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/app/shared/%5Bid%5D/page.tsx) with editing triggers disabled (`readOnly={true}`).

## Phase 10: Canvas Lane-Layout & Page Isolation (Completed)

To address visual layout aesthetics and component leakage on the wireframe canvas:
- **Active Page Component Isolation**:
  - Filtered the visual canvas elements so only components matching the selected page node's ID (or its nested children organisms) are rendered, preventing cross-page leakage.
- **Horizontal Lane-Grid Auto-Layout**:
  - Added a reactive coordinate spacing engine in [VisualCanvas.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/VisualCanvas.tsx) that checks for nodes missing layout coordinates (defaulting from decomposition).
  - Dynamically arranges missing components into horizontally spaced lanes based on their classification (Organisms in row 1, Molecules in row 2, Atoms in row 3).
  - Positions are assigned immediately in-memory for zero-latency UI loading, then saved back to the Supabase database in the background for persistence.

## Phase 11: Active Node State Preservation (Completed)

To fix resetting states and page jumps:
- **Active Node State Locking**:
  - Refactored `handleSelectPlan` in [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx) to support a `keepActiveNode` toggle flag.
  - If enabled, the function preserves `activeNode` state selections and keeps the undo/redo stack intact during DB fetches.
  - Automatically matches and sets the fresh node dataset records matching the preserved node ID.
- **Refresh Callback Isolation**:
  - Integrated `keepActiveNode = true` parameters inside visual canvas refreshing listeners (`onRefreshWorkspace`) and lazy decomposition loaders, ensuring user view persistence on saves.

## Phase 12: Trackpad Panning & Modifier Zoom (Completed)

To align canvas controls with professional design tools (Figma/Miro):
- **Mouse & Trackpad Swipe Panning**:
  - Modified `handleWheel` in [CanvasBoard.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/canvas/CanvasBoard.tsx).
  - Normal vertical scroll wheel rolls and trackpad horizontal/vertical swipes pan the board directly in 2D space (`panX` and `panY`).
- **Modifier-Keys Based Zoom**:
  - Hold down the Command (`Cmd`) or Control (`Ctrl`) key while scrolling to trigger cursor-centered zoom modifications, preventing unintended scroll zooming.

## Phase 13: Butter-Smooth Drag-and-Drop Optimization (Completed)
