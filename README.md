# 🚀 Frontend Planner (AI-Powered Architecture Orchestrator)

[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel AI SDK](https://img.shields.io/badge/Orchestrator-Vercel%20AI%20SDK-white?style=for-the-badge&logo=vercel)](https://sdk.vercel.ai/)

**🔗 Live Demo:** [https://frontend-planner-one.vercel.app/](https://frontend-planner-one.vercel.app/)

An interactive, premium-designed frontend architecture orchestrator. **Frontend Planner** decomposes high-level, vague product briefs into structured, page-level route trees, atomic components, hooks, contexts, and dependencies, ready to export as clean codebases or optimized coding prompts for AI agents (Cursor, Claude Code, GitHub Copilot).

---

## ✨ Features

- **🎯 Brief Decomposition:** Turns a raw product description into a logical Page Router architecture for React/Next.js or Svelte/Vue.
- **⚛️ Lazy Atomic Drilling:** Recursively breaks down page route nodes into components (Atoms, Molecules, Organisms), custom Hooks/Composables, Contexts/Stores, Data Interfaces, Mock Data JSONs, and Third-Party Libs.
- **🔄 Smart LLM Orchestration & Failover:**
  - Dual provider support (Google Gemini & Anthropic Claude).
  - Tries custom API keys with pro models, falls back to flash models on errors, and automatically offers to use the default system key.
- **💡 Quota Fallback Modal:** If a custom key hits a rate limit or quota block (429/quota error), a glassmorphic modal prompts the user to fallback to the system's default key.
- **💰 Real-Time Cost Indicators:** Track estimated token-based monetary cost per generation.
- **📊 Visual LLM Cost & Usage Dashboard:** Opens an analytics modal to inspect total API spend, token consumption, output token efficiency ratio, and key allocation metrics.
- **🔄 Undo / Redo Workspace History:** session-based state management that works instantaneously and syncs changes to Supabase in the background (debounced at 600ms).
- **🌐 Shareable Read-Only Workspace Links:** Turn on the public switch to get a copyable read-only dashboard link (`/shared/[id]`) for external developers to inspect the architecture, validate plan coherence, copy prompts, and export boilerplate ZIP archives.
- **💚 Vue & Svelte Atomic Layouts Support:** Native generation configurations for Vue (Nuxt Composition API, Pinia stores) and Svelte (SvelteKit Runes `$state`/`$props`, reactive writable stores) in code exports, forms, and master prompt compilers.
- **🛡️ Coherence & Dependency Validation:** Analyzes parent-child component mappings, validation warnings, and highlights circular dependencies.
- **📦 Multi-Format Exports:** Download the entire planned directory structure as a clean boilerplate folder ZIP, a complete Markdown specification report, or raw JSON schema.

---

## 🏗️ System Architecture

```mermaid
graph TD
    User[Developer / Architect] -->|Enters Brief| WebUI[Next.js HSL Glassmorphic Dashboard]
    WebUI -->|HTTP Post + Optional Custom x-api-key| API[API Routing Layer]
    API -->|Key Fallback & Failover| LLM[LLM Orchestrator: lib/llm.ts]
    LLM -->|1. Try Custom Pro Model| ProviderAPI[Gemini / Claude API]
    LLM -->|2. Try Custom Flash Model| ProviderAPI
    LLM -->|3. Fallback to System Pro/Flash| ProviderAPI
    ProviderAPI -->|Structured JSON| API
    API -->|Insert Layout & Pages| DB[(Supabase PostgreSQL Database)]
    DB -->|Fetch Workspace Data| WebUI
    WebUI -->|Generate Specs Prompt| CursorAgent[AI Coding Agent / Cursor]
    WebUI -->|Compile Codebase ZIP| ZIP[Boilerplate ZIP Export]
```

---

## 📊 Database Schema

The database relies on strict Row Level Security (RLS) policies to isolate plans and components per authenticated user, while allowing public read-only access to shared workspaces:

1. **`profiles`**: Synchronizes logged-in users from Supabase Auth.
2. **`plans`**: Contains the main plan metadata, framework configuration, `is_public` sharing flag, and `total_cost` (fine-grained precision up to 6 decimal places).
3. **`plan_nodes`**: Stores page routes and their lazy-decomposed children (components, hooks, shapes, etc.) with metadata parameters.
4. **`plan_node_dependencies`**: Tracks relationships (e.g., `uses_context`, `uses_hook`, `uses_component`) to prevent circular dependencies.
5. **`llm_usage_logs`**: Logs individual query executions, input/output token metrics, models, and cost parameters.

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase Account / Local CLI Instance
- Google AI Studio API Key or Anthropic Console Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ZainDhariwal/Frontend-Planner.git
   cd Frontend-Planner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (`.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_fallback_gemini_key
   ANTHROPIC_API_KEY=your_fallback_anthropic_key
   ```

4. Apply Supabase Migrations:
   Run the SQL file inside `supabase/migrations/20260610000000_init.sql` on your Supabase SQL Editor.

5. Run development server:
   ```bash
   npm run dev
   ```

---

## 🚀 Usage Flow

1. **Sign In:** Authenticate using Google Auth or a demo user account.
2. **Setup API Key (Optional):** Click on the settings icon on the Navbar to store your own Gemini or Claude API key locally in the browser's `localStorage` (keys are never saved on the server).
3. **Create a Plan:** Provide a title, choose a framework (Next.js/React), and enter a product brief.
4. **Decompose Route Pages:** Click **Decompose** on any generated page route node to generate its internal atomic structure.
5. **Regenerate / Modify:** Click **Redo** to re-decompose a node with custom specifications, or edit details directly inside the inspector sidebar.
6. **Code Scaffolding:** Copy prompt specifications directly to feed into Cursor, or export a ZIP of files.

---

## 📄 Sample Plan Output (Non-Trivial Example)

Below is an example of a decomposed plan generated by the tool for a **SaaS CRM & Lead Tracker App**:

### Page Route: `/dashboard`
* **Description:** Main analytical view showing metrics cards, recent lead activity graph, and task alerts.
* **Decomposed Nodes:**
  - **`LeadMetricsGrid` (Component - Organism):** Flexbox grid containing summary KPI cards.
    - *Props:* `data: Metric[]`, `isLoading: boolean`
  - **`LeadCard` (Component - Atom):** Displays individual metric percentage changes.
  - **`LeadActivityChart` (Component - Molecule):** Displays lead acquisition timelines using `recharts`.
  - **`useDashboardStats` (Custom Hook):** Handles fetching and caching metric summaries.
    - *Outputs:* `stats: Metric[]`, `error: any`

### Page Route: `/leads`
* **Description:** Paginated leads management dashboard with status filters, search bars, and lead action sheets.
* **Decomposed Nodes:**
  - **`LeadsTable` (Component - Organism):** Lists lead details with sorting and edit triggers.
    - *Props:* `leads: Lead[]`, `onSelect: (id: string) => void`
  - **`LeadStatusBadge` (Component - Atom):** Colorized badge showing lead statuses (Hot, Warm, Cold).
  - **`useLeadsData` (Custom Hook):** Manages pagination, text query filtering, and status filters.
  - **`LeadContext` (Context Provider):** Global context storing active filter query state and lead updates.
  - **`Lead` (TypeScript Interface - Data Shape):**
    ```typescript
    export interface Lead {
      id: string;
      name: string;
      email: string;
      company: string;
      status: 'hot' | 'warm' | 'cold';
      value: number;
      created_at: string;
    }
    ```
  - **`mockLeads` (Mock Data):** JSON array containing realistic mock lead objects.

