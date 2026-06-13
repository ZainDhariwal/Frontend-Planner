# System Specifications - Frontend Project Planner

This document provides the comprehensive system, design, database, API, and orchestration specifications of the **Frontend Project Planner**.

---

## 💻 Tech Stack & Client Environment

### Core Frontend Specifications
* **Framework**: Next.js 16.2.9 (App Router, Turbopack compiler)
* **Runtime**: React 19 / TypeScript 5
* **CSS & Styling System**:
  - Tailwind CSS v4 integration.
  - Custom glassmorphic design token variables defined in `app/globals.css` with a default `dark` class toggle on the HTML document root for theme synchronization.
  - Interactive frosted overlays built with `backdrop-blur` and semi-transparent HSL color tokens.

### Client-Side State & Event Management
1. **Interactive Canvas Engine**:
   - Zoom range: `0.1x` to `2.0x`. Pan support using custom pointer movement math on mouse-wheel or canvas drag gestures.
   - Bounding-box parenting engine (deterministic container containment calculations in `CanvasBoard.tsx`):
     ```typescript
     const childInsideParent =
       child.x >= parent.x &&
       child.y >= parent.y &&
       child.x + child.width <= parent.x + parent.width &&
       child.y + child.height <= parent.y + parent.height;
     ```
     - Automatically updates and sets the child's `parent_id` in the database when dropped within an organism card.
   - Interactive Minimap tracking screen spatial offsets.
   - Corner resize handles adjusting nodes dynamically.
2. **Undo/Redo History**:
   - Implemented via a session state cache stack (`undoStack` and `redoStack`) inside the core React state provider in [DashboardWorkspace.tsx](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/components/organisms/DashboardWorkspace.tsx).
   - Instant UI restoration upon rollback, with automated background database synchronizations debounced at `600ms` via `queueDatabaseSync` to prevent Supabase writing bottle-necks or locks.

---

## 🗄️ Database Schema & Security (Supabase PostgreSQL)

Strict Row Level Security (RLS) is applied across all active tables to keep user plans isolated from unauthorized write or view requests. Shared links bypass this to allow read-only access only if a plan is explicitly toggled to public (`is_public = true`).

### 1. `profiles`
Tracks authenticated developers:
- `id` (uuid, primary key) -> References `auth.users(id)`
- `updated_at` (timestamp with time zone)
- `username` (text)
- `avatar_url` (text)

### 2. `plans`
Defines project scopes and metadata:
- `id` (uuid, primary key)
- `user_id` (uuid) -> References `profiles(id)`
- `title` (text)
- `brief` (text)
- `framework` (text) -> `nextjs-react` | `nuxt-vue` | `sveltekit-svelte`
- `total_cost` (numeric(15, 6), default 0) -> Tracking precise monetary API consumption up to 6 decimal places.
- `is_public` (boolean, default false) -> Public read-only workspace visibility toggle.
- `created_at` / `updated_at` (timestamps)

### 3. `plan_nodes`
Stores the individual page routes, components, and attributes:
- `id` (uuid, primary key)
- `plan_id` (uuid) -> References `plans(id)` on delete cascade
- `parent_id` (uuid) -> Self-referential nullable link representing parent container / group
- `type` (text) -> `page` | `component` | `hook` | `context` | `interface` | `mock` | `library`
- `name` (text) -> Component or file identification (e.g. `TicketTable`, `useAuth`)
- `description` (text) -> Plaintext explanation of features
- `metadata` (jsonb) -> Stores spatial coordinates for the visual canvas (`x`, `y`, `width`, `height`, `zIndex`, `collapsed`) and framework attributes (e.g. component props, hook inputs/outputs)
- `created_at` / `updated_at` (timestamps)

### 4. `plan_node_dependencies`
Represents relationships and import references:
- `id` (uuid, primary key)
- `plan_id` (uuid) -> References `plans(id)`
- `source_node_id` (uuid) -> Dependee node references `plan_nodes(id)`
- `target_node_id` (uuid) -> Target node references `plan_nodes(id)`

### 5. `llm_usage_logs`
Logs queries for analytics:
- `id` (uuid, primary key)
- `plan_id` (uuid) -> References `plans(id)`
- `model` (text) -> Model used for generation (e.g. `gemini-2.5-pro`)
- `input_tokens` (integer)
- `output_tokens` (integer)
- `cost` (numeric(15, 6)) -> Price charged in USD
- `created_at` (timestamp)

---

## 🔌 API Endpoints Specifications

All API routes authenticate requests using client session cookies.

### 1. `/api/plans/generate` (POST)
- **Purpose**: Generates the high-level page route tree based on the brief.
- **Input**: `{ title: string, brief: string, framework: string }`
- **Output**: JSON schema representing pages, metadata paths, and framework configurations.

### 2. `/api/plans/decompose` (POST)
- **Purpose**: Generates components, custom hooks, and mock data for a single page node on-demand.
- **Input**: `{ planId: string, pageNodeId: string }`
- **Output**: Returns the atomic list of child nodes and dependency edges.

### 3. `/api/plans/regenerate` (POST)
- **Purpose**: Updates or changes a specific component or page structure based on user prompts.
- **Input**: `{ planId: string, nodeId: string, prompt: string }`
- **Output**: Updated node details and specifications.

### 4. `/api/plans/[id]/canvas-suggest` (POST)
- **Purpose**: Creates automatic layout configurations and sets canvas spatial positions based on a prompt.
- **Input**: `{ pageId: string, brief: string }`
- **Output**: Visual coordinate templates.

### 5. `/api/plans/[id]/canvas-analyze` (POST)
- **Purpose**: Scans layout bounds and updates node properties.
- **Input**: `{ pageId: string, canvasData: any }`
- **Output**: Updated TypeScript definitions, hook attributes, and components metadata.

---

## 🤖 LLM Failover & Cost Precision Logic

Orchestrated inside [lib/llm.ts](file:///Users/zain/Documents/JavaScript/Frontend%20Planner/lib/llm.ts), the generation cycle handles billing boundaries and credentials dynamically.

### Key & Model Fallback Sequence
1. **Try Custom API Key & Pro Model**: Custom user key with `gemini-2.5-pro` or `claude-3-5-sonnet`.
2. **Try Custom API Key & Flash Model**: If rate-limited or blocked, falls back to `gemini-2.5-flash` or `claude-3-5-haiku`.
3. **Prompt User for Free Fallback**: If custom key fails entirely, displays a glassmorphic modal offering to use the system key (free tier).
4. **Try System Default API Key & Pro Model**: Falls back to server-side `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`.
5. **Try System Default API Key & Flash Model**: Final recovery level.

### Pricing Model Matrix (USD per 1 Million Tokens)
| Model | Input Price ($/1M) | Output Price ($/1M) |
|---|---|---|
| **Gemini 2.5 Pro** | $1.25 | $5.00 |
| **Gemini 2.5 Flash** | $0.075 | $0.30 |
| **Claude 3.5 Sonnet** | $3.00 | $15.00 |
| **Claude 3.5 Haiku** | $0.80 | $4.00 |

*Note: Queries running on the system fallback default keys have their estimated monetary cost forced to `0.000000` to prevent users from seeing calculated costs on a free public tier.*
