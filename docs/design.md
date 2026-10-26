# Design Philosophy & Design System

## 🌌 Core Aesthetic & User Experience Goals

Agent Studio OS embraces a **modern, glassmorphism-inspired aesthetic** that blends futuristic transparency with functional clarity. The interface is engineered to feel like an advanced operating system cockpit for orchestrating autonomous digital workforces.

### Key Design Principles

1. **Glassmorphism & Layered Depth**:
   - Translucent panels with subtle border highlights (`border-border`) and soft backdrops (`backdrop-blur-xl`) create visual hierarchy without clunky dividing lines.
   - Dedicated utility classes (`glass`, `glass-card`, `glass-elevated`) provide structured elevation levels.
   - Ambient background gradients and subtle radial glows add a premium feel while maintaining clean typography contrast.

2. **Dark / Light Duality**:
   - **Light Theme**: Crisp slate and pure white tones with subtle indigo accents for daytime high-contrast productivity.
   - **Dark Theme**: Deep obsidian, carbon titanium, and midnight indigo backgrounds, completely eliminating harsh blue washes for comfortable night-time focus.
   - Seamless, flicker-free switching between themes via `ThemeProvider` with full state preservation.

3. **High Information Density with Visual Breathing Room**:
   - Compact layouts that maximize screen real estate for complex workflows (DAG canvases, Code IDE, Kanban boards) without cognitive overload.
   - Color-coded badges, status dots, and micro-typography (monospaced labels for IDs, tokens, and latencies).

4. **Fluid Motion & Reactive Feedback**:
   - Purposeful micro-animations using Framer Motion for state changes, modal reveals, and layout shifts.
   - Tactile feedback: Loading spinners, live pulse animations for speaking/busy agents, and web audio sound effects for task started, completed, and error alerts.

5. **Agent-Centric Identity**:
   - Consistent agent representation (avatar, name, role badge, theme color) across all views (Chat, Kanban, Conference, Routines, and Memory).
   - Dynamic accent lines on agent cards reflecting individual agent theme colors.

---

## 🎨 Design System Specifications

### Color Tokens

#### Light Theme
| Token | Value | Semantic Role |
|---|---|---|
| `--background` | `#f8fafc` (slate-50) | Main application canvas background |
| `--foreground` | `#0f172a` (slate-900) | Primary text and headings |
| `--card` | `#ffffff` (white) | Card, drawer, and modal surfaces |
| `--card-foreground` | `#0f172a` (slate-900) | Card typography |
| `--primary` | `#4f46e5` (indigo-600) | Primary buttons, active tabs, brand accents |
| `--primary-foreground` | `#ffffff` (white) | Text on primary elements |
| `--secondary` | `#f1f5f9` (slate-100) | Secondary buttons, subtle highlights |
| `--secondary-foreground` | `#1e293b` (slate-800) | Secondary typography |
| `--muted` | `#f1f5f9` (slate-100) | Inactive containers, subtle chips |
| `--muted-foreground` | `#64748b` (slate-500) | Metadata, timestamps, helper text |
| `--accent` | `#e2e8f0` (slate-200) | Hover backgrounds and subtle separators |
| `--destructive` | `#e11d48` (rose-600) | Error alerts, delete actions, warnings |
| `--border` | `#e2e8f0` (slate-200) | Container outlines and card borders |
| `--ring` | `#4f46e5` (indigo-600) | Focus rings and selection highlights |

#### Dark Theme
| Token | Value | Semantic Role |
|---|---|---|
| `--background` | `#09090b` (near black) | Main application canvas background |
| `--foreground` | `#fafafa` (near white) | Primary text and headings |
| `--card` | `#111115` (deep obsidian) | Card, drawer, and modal surfaces |
| `--card-foreground` | `#fafafa` (near white) | Card typography |
| `--primary` | `#6366f1` (indigo-500) | Primary buttons, active tabs, brand accents |
| `--primary-foreground` | `#ffffff` (white) | Text on primary elements |
| `--secondary` | `#18181b` (zinc-900) | Secondary buttons, subtle highlights |
| `--secondary-foreground` | `#f4f4f5` (zinc-100) | Secondary typography |
| `--muted` | `#141417` (zinc-950) | Inactive containers, subtle chips |
| `--muted-foreground` | `#a1a1aa` (zinc-400) | Metadata, timestamps, helper text |
| `--accent` | `#202025` (zinc-800) | Hover backgrounds and subtle separators |
| `--destructive` | `#f43f5e` (rose-500) | Error alerts, delete actions, warnings |
| `--border` | `rgba(255, 255, 255, 0.08)` | Container outlines and card borders |
| `--ring` | `#6366f1` (indigo-500) | Focus rings and selection highlights |

---

## 📐 Layout & Typography Architecture

### Typography
- **Sans-Serif Font Stack**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif` for high-legibility UI text and headings.
- **Monospace Font Stack**: `JetBrains Mono`, `ui-monospace`, `monospace` for code snippets, JSON payloads, model names, latency readings, and token counts.
- **Heading Scale**:
  - `h1`: `text-2xl` to `text-3xl` (`font-bold`, `tracking-tight`)
  - `h2`: `text-lg` to `text-xl` (`font-semibold`)
  - `h3`: `text-sm` to `text-base` (`font-semibold`)
  - Body: `text-xs` to `text-sm` (`font-normal`, `leading-relaxed`)
  - Captions/Chips: `text-[10px]` to `text-xs` (`font-mono`, `tracking-wide`)

### Spacing & Grid System
- Built on Tailwind CSS 4's 4px base increment (`p-1` = 4px, `p-4` = 16px, `p-6` = 24px).
- Maximum cockpit width: `max-w-[1600px]` with fluid responsive gutter padding (`px-3 sm:px-6 lg:px-8`).
- Standard border radiuses:
  - Buttons & Inputs: `rounded-xl`
  - Cards & Drawers: `rounded-2xl`
  - Floating Orbs & Avatars: `rounded-full`

---

## 🎛️ Specialized Component Design Specifications

### 1. Visual DAG Workflow Automation Canvas (`/workflows`)
- **Canvas Environment**: Infinite pan-and-zoom surface with grid-dot background (`bg-dot-pattern`), zoom level indicator, and centering controls.
- **Nodes**:
  - Rounded rectangular cards with colored header bands indicating node type (Agent, Branch, Router, Approval, Deliverable).
  - Input/Output connector ports on left and right borders with visual hover states and glowing connection feedback.
  - Active execution glow (cyan pulse for executing nodes, emerald border for completed, amber for pending approval).
- **Edges**: Smooth cubic bezier curve wires with animated dash patterns during active execution.

### 2. Autonomous Code Studio & Web IDE (`/code`)
- **Dual-Pane Workstation**:
  - Left pane: File tree explorer with directory collapse/expand and quick action buttons (New File, New Folder, Upload, Download ZIP).
  - Center pane: Tabbed code editor with line numbering, syntax highlighting, and search/replace toolbar.
  - Right pane: Live multi-viewport sandbox preview with toggleable Desktop (`1200px`), Tablet (`768px`), and Mobile (`375px`) device frames.
- **Console Drawer**: Slide-up collapsible drawer at the bottom of the editor capturing real-time stdout, runtime exceptions, and console messages.
- **Diff Modal**: Side-by-side or unified diff viewer highlighting additions in emerald and deletions in rose.

### 3. Multi-Agent Conference Room (`/conference`)
- **Live Event Stream**: Real-time chronological activity feed displaying thought processes, speaking states, delegations, and syntheses with avatar associations.
- **Agent Inspector Modal**: Floating inspection panel revealing active agent prompts, assigned models, and token consumption.
- **Artifact Banner**: Slide-out deliverable drawer displaying synthesized conference reports with one-click export and Kanban dispatch buttons.

### 4. Floating Gemini Live Voice Orb HUD (`gemini-live-orb.tsx`)
- **Interactive Floating Orb**: Positioned at the screen periphery with smooth drag positioning.
- **Audio Telemetry Visualizer**: Multi-ring particle visualizer that pulses and changes color based on microphone input volume and speaker output frequency.
- **State Badges**: Explicit status indicators (*Listening*, *Thinking*, *Speaking*, *Interrupted*).

### 5. Autonomous Kanban Task Drawer (`task-drawer.tsx`)
- **Slide-Out Inspection Drawer**: Full-height drawer sliding in from the right edge with backdrop blur.
- **Action Control Bar**: Quick-action buttons for 1-Click Run, Swarm Decomposition, Self-Reflection Critique, and Subtask Deconstruction.
- **Interactive Review Interface**: Dedicated Approve, Request Revision (with critique input box), and Reject action flows.
- **Subtask Checklist**: Checkable items with individual progress bars and assigned specialist avatars.

### 6. Interactive 3D Knowledge Galaxy (`obsidian-graph.tsx`)
- **Physics Canvas**: Three.js-style interactive canvas with force-directed node positioning and particle starfield background.
- **Color Coding**: Nodes clustered and colored by directory community or tag affinity.
- **God Nodes**: High-degree hub nodes rendered with larger radii and luminous halo glows.

---

## 🔊 Sound Design & Auditory Feedback

Agent Studio OS includes subtle Web Audio API sound synthesizers (`sound-effects.ts`) providing immediate tactile confirmation:
- **Task Started Sound**: Gentle dual-tone ascending chime (440Hz ➔ 880Hz).
- **Task Completed Sound**: Warm harmonic major triad (523Hz ➔ 659Hz ➔ 784Hz).
- **Warning / Error Sound**: Soft descending alert tone (350Hz ➔ 220Hz).
- **Click Sound**: Crisp, subtle 10ms micro-click for responsive button interaction.