# Design Philosophy

## Core Aesthetic & User Experience Goals

Agent Studio OS embraces a **modern, glassmorphism-inspired aesthetic** that blends futuristic transparency with functional clarity. The design philosophy centers on creating an immersive yet professional environment for managing autonomous AI agents.

### Key Design Principles

1. **Glassmorphism & Depth**: 
   - Translucent panels with subtle borders and shadows create layered depth
   - Frosted glass effects (`glass`, `glass-card`, `glass-elevated` classes) provide visual hierarchy
   - Background gradients and ambient glows add premium feel without distraction

2. **Dark/Light Duality**:
   - Thoughtfully crafted light theme (slate & pure white) for daytime productivity
   - Dark theme (obsidian & carbon titanium) eliminates blue wash for night use
   - Seamless transitions between themes with preserved visual language

3. **Information Density & Clarity**:
   - Compact layouts that maximize utility without sacrificing readability
   - Clear visual hierarchy through elevation, color, and typography
   - Purposeful whitespace to prevent cognitive overload

4. **Motion & Feedback**:
   - Purposeful animations using Framer Motion for state transitions
   - Micro-interactions that confirm actions without being distracting
   - Loading states and progress indicators that maintain user context

5. **Agent-Centric Design**:
   - Every interface element serves the core mission of agent orchestration
   - Consistent agent representation (avatar, name, role, status) throughout
   - Personalization through agent-specific themes and directives

## Design System

### Color Palette

#### Light Theme (Default)
- **Background**: `#f8fafc` (slate-50)
- **Foreground**: `#0f172a` (slate-900)
- **Primary**: `#4f46e5` (indigo-600)
- **Primary Foreground**: `#ffffff` (white)
- **Secondary**: `#f1f5f9` (slate-200)
- **Secondary Foreground**: `#1e293b` (slate-600)
- **Muted**: `#f1f5f9` (slate-200)
- **Muted Foreground**: `#64748b` (slate-500)
- **Accent**: `#e2e8f0` (slate-200)
- **Accent Foreground**: `#0f172a` (slate-900)
- **Destructive**: `#e11d48` (rose-500)
- **Destructive Foreground**: `#ffffff` (white)
- **Border**: `#e2e8f0` (slate-200)
- **Input**: `#cbd5e1` (slate-300)
- **Ring**: `#4f46e5` (indigo-600)

#### Dark Theme
- **Background**: `#09090b` (near black)
- **Foreground**: `#fafafa` (near white)
- **Primary**: `#6366f1` (indigo-500)
- **Primary Foreground**: `#ffffff` (white)
- **Secondary**: `#18181b` (gray-800)
- **Secondary Foreground**: `#f4f4f5` (gray-100)
- **Muted**: `#141417` (gray-900)
- **Muted Foreground**: `#a1a1aa` (gray-400)
- **Accent**: `#202025` (gray-900)
- **Accent Foreground**: `#ffffff` (white)
- **Destructive**: `#f43f5e` (rose-400)
- **Destructive Foreground**: `#ffffff` (white)
- **Border**: `rgba(255, 255, 255, 0.08)`
- **Input**: `rgba(255, 255, 255, 0.12)`
- **Ring**: `#6366f1` (indigo-500)

### Semantic Color Usage
- **Primary**: Main actions, agent theme colors, key highlights
- **Secondary**: Backgrounds, secondary actions, subtle emphasis
- **Muted**: Secondary text, disabled states, de-emphasized content
- **Accent**: Borders, dividers, subtle separators
- **Destructive**: Error states, delete actions, critical warnings
- **Border**: Container boundaries, input fields, cards
- **Ring**: Focus states, active indicators, selection highlights

### Typography
- **Font Stack**: 
  - Sans: `var(--font-sans)`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`
  - Mono: `var(--font-mono)`, `"JetBrains Mono"`, `ui-monospace`, `monospace`
- **Font Smoothing**: Antialiased for WebKit, grayscale for Firefox
- **Text Styles**: 
  - Headings: Bold, appropriate sizing for hierarchy
  - Body: Regular weight, optimized line height for readability
  - Mono: Used for code, technical data, agent IDs
  - Captions: Smaller size, muted colors for metadata

### Spacing & Layout
- **Base Unit**: 4px increments (Tailwind's default spacing scale)
- **Border Radius**: 
  - Small: `calc(var(--radius) - 4px)`
  - Medium: `calc(var(--radius) - 2px)`
  - Large: `var(--radius)` (0.875rem / 14px)
  - Extra Large: `calc(var(--radius) + 4px)`
  - 2XL: `calc(var(--radius) + 8px)`
- **Container Padding**: Consistent use of `p-6` (1.5rem) for card content
- **Element Spacing**: `space-y-*` and `gap-*` utilities for vertical/horizontal spacing
- **Breakpoints**: Standard Tailwind responsive prefixes (sm, md, lg, xl, 2xl)

### Elevation & Shadows
- **Glass Cards**: `0 4px 20px -2px rgba(0, 0, 0, 0.05)` (light), enhanced in dark mode
- **Elevated Glass**: `0 10px 30px -5px rgba(0, 0, 0, 0.08)` (light), enhanced in dark mode
- **Ambient Glow**: Radial gradient backgrounds with fixed attachment for depth
- **Focus Rings**: 2px offset-ring using `--color-ring` variable
- **Hover States**: Subtle elevation increases and color shifts

### Component Variants
- **Agent Cards**: 
  - Top border accent color (`agent.themeColor`)
  - Status indicator (dot: emerald for online, secondary for offline)
  - Role badge (color-coded by role: orchestrator, manager, specialist, worker)
  - Department label
  - Compact info line (tools, integrations, model)
  - Action buttons (Chat, Memory, Hermes CLI, Edit, Delete)
  
- **Forms & Inputs**:
  - Rounded XL borders (`rounded-xl`)
  - Secondary background (`bg-secondary/40` or `bg-card/90 backdrop-blur-xl`)
  - Foreground text (`text-foreground`)
  - Placeholder styling (`placeholder:text-muted-foreground`)
  - Focus states (`focus:border-primary focus:ring-1 focus:ring-primary`)
  
- **Buttons**:
  - Primary: `bg-primary text-primary-foreground hover:bg-primary/90`
  - Secondary: `bg-secondary/50 text-muted-foreground hover:bg-secondary/70`
  - Danger: Variants with destructive colors
  - Icon buttons: Compact sizing with hover backgrounds
  
- **Modals & Overlays**:
  - Backdrop: `fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md`
  - Container: `w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden`
  - Header/Footer: Border separation with padded sections
  
- **Tabs & Navigation**:
  - Active state: `bg-card text-foreground shadow-sm font-bold border border-border`
  - Inactive state: `text-muted-foreground hover:text-foreground`
  - Transition effects for smooth state changes

## Component Guidelines

### Reusable UI Components
Based on the codebase analysis, these patterns emerge for building reusable components:

#### Agent Representation
- **Avatar**: Circular or rounded display (emoji or image) with theme-colored background
- **Name/ID**: Display name with `@slug` identifier
- **Status Indicator**: Colored dot (online/offline) with tooltip
- **Role Badge**: Color-coded label with department context
- **Theme Accent**: Top border or accent element in agent's theme color

#### Card Components
- **Base Styles**: `glass-card` or `glass-elevated` classes for translucency
- **Padding**: Consistent `p-4` to `p-6` internal spacing
- **Borders**: `border border-border` with optional accent borders
- **Shadows**: Appropriate elevation for depth perception
- **Radius**: Consistent use of `--radius` variables
- **Layout**: Flex or grid containers with defined gaps

#### Form Elements
- **Inputs**: 
  - Container: `rounded-xl border border-border bg-secondary/40`
  - Text: `px-4 py-2.5 text-sm font-semibold text-foreground`
  - Placeholder: `placeholder:text-muted-foreground`
  - Focus: `focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary`
- **Selects**: Similar styling to inputs with consistent height
- **Textareas**: `resize-y` for vertical resizing only, consistent font sizing
- **Checkboxes/Radio**: Custom styled or using accessible libraries with theme colors

#### Data Display
- **Badges**: 
  - Small: `px-2 py-0.5 rounded-md text-[10px] font-semibold`
  - Variants: Background/foreground color combinations for semantics
  - Examples: status, priority, model type indicators
- **Tags**: 
  - Pill shape: `px-2.5 py-0.5 rounded-full text-[10px]`
  - Used for tools, integrations, categories
- **Lists & Tables**:
  - Consistent row padding and border separation
  - Hover states for interactive rows
  - Truncation for overflow text (`truncate` class)
  - Alignment utilities for numeric vs text data

#### Navigation & Controls
- **Sidebar**: 
  - Collapsible with icon-only collapsed mode
  - Consistent item height and spacing
  - Active item highlighting
  - Smooth transition animations
- **Headers**: 
  - Flex layout with justified spacing
  - Avatar + text combinations for user context
  - Action buttons on right side
- **Buttons**: 
  - Consistent height and touch targets (min 44x44px)
  - Clear labeling with optional icon prefixes/suffixes
  - Loading states and disabled styling
  - Icon-only buttons for secondary actions (with tooltips)

### Interaction Patterns
1. **State Transitions**: 
   - Smooth animations for modal open/close (`animate-presence`)
   - Scale and fade effects for card interactions
   - Spring physics for natural-feeling motion

2. **Feedback Mechanisms**:
   - Visual: Color shifts, elevation changes, icon transformations
   - Textual: Toast notifications (`sonner`) for transient messages
   - Auditory: Configurable audio feedback (not implemented in current codebase)

3. **User Assistance**:
   - Tooltips for icon-only buttons and abbreviated labels
   - Placeholder text in empty states
   - Guided tours or onboarding flows (not shown in current code)
   - Contextual help icons linking to documentation

4. **Accessibility Considerations**:
   - Semantic HTML structure
   - Sufficient color contrast (verified in theme definitions)
   - Focus management in modals and dialogs
   - Keyboard navigation support
   - ARIA labels where semantic meaning isn't obvious

## Responsive Breakpoints

Agent Studio OS follows a **mobile-first responsive design** using Tailwind CSS breakpoints:

### Breakpoint Definitions
- **sm**: 640px (small phones, portrait tablets)
- **md**: 768px (tablets, small laptops)
- **lg**: 1024px (laptops, small desktops)
- **xl**: 1280px (desktops, large screens)
- **2xl**: 1536px (large desktops, 4K displays)

### Responsive Behavior by Component

#### Layout Containers
- **Mobile (below sm)**: 
  - Full-width containers
  - Vertical stacking of sections
  - Minimal side padding (`p-4` or `p-3`)
- **Tablet (sm to lg)**:
  - Increased horizontal padding (`p-6`)
  - Some side-by-side layouts where beneficial
  - Responsive grid adjustments
- **Desktop (lg and above)**:
  - Maximum width containers (`max-w-7xl` or similar)
  - Multi-column layouts (sidebar + main content)
  - Expanded padding and whitespace

#### Navigation Patterns
- **Mobile**:
  - Bottom navigation or drawer menu
  - Collapsible sidebar with icon-only mode
  - Priority given to primary actions
- **Tablet**:
  - Optional collapsible sidebar
  - Tab bars for secondary navigation
  - Adaptive header layouts
- **Desktop**:
  - Persistent sidebar with expand/collapse
  - Horizontal header navigation
  - Breadcrumb trails for deep navigation

#### Data Presentation
- **Tables**:
  - Mobile: Vertical card representation or horizontal scroll
  - Tablet: Condensed columns with priority fields visible
  - Desktop: Full table with column sorting/resizing
- **Cards**:
  - Mobile: Full-width, vertical stacking
  - Tablet: 2-column grid
  - Desktop: 3-4 column grid depending on content
- **Forms**:
  - Mobile: Single column, full-width inputs
  - Tablet: Two-column grouping where logical
  - Desktop: Multi-column with field grouping

#### Specific Component Breakpoints
- **Agent Fleet View**:
  - Mobile: Vertical list of agent cards
  - Tablet: 2-column grid
  - Desktop: 3-4 column grid with optional hierarchy view
- **Chat Interface**:
  - Mobile: Full-screen message input, collapsible sidebar
  - Tablet: Side-by-side chat and agent list
  - Desktop: Three-pane layout (agents, chat, vault preview)
- **Kanban Board**:
  - Mobile: Vertical stack of lists, scrollable
  - Tablet: Horizontal scrollable lists
  - Desktop: Fixed-height lists with vertical scrolling within columns
- **Settings Pages**:
  - Mobile: Vertical form sections
  - Tablet: Two-column setting groups
  - Desktop: Sidebar navigation with main content area

### Responsive Utilities Used
- **Hidden Shown**: `hidden sm:block`, `md:hidden`, etc. for breakpoint-specific visibility
- **Grid Columns**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for adaptive layouts
- **Text Sizing**: `text-base lg:text-lg` for responsive typography
- **Spacing**: `p-4 md:p-6` for responsive padding
- **Flex Direction**: `flex-col sm:flex-row` for layout direction changes
- **Column Span**: `col-span-1 lg:col-span-8` for responsive grid placement

## Implementation Guidelines

### Adding New Components
1. **Start Mobile-First**: Design for smallest screen first, then enhance
2. **Use Semantic Classes**: Leverage existing utility classes (`glass-card`, `rounded-xl`, etc.)
3. **Follow Theme Variables**: Use `--color-*`, `--radius`, `--font-*` CSS variables
4. **Maintain Consistency**: Match existing padding, border-radius, and spacing patterns
5. **Consider Dark Mode**: Test all variations in both light and dark themes
6. **Add Transitions**: Use Framer Motion or CSS transitions for state changes
7. **Ensure Accessibility**: Verify contrast, focus states, and screen reader compatibility

### Extending the Design System
1. **Colors**: Add new semantic colors to `:root` and `.dark` sections in globals.css
2. **Radius**: Update `--radius` variable or add new size variables
3. **Typography**: Extend font stack or add new text utility classes
4. **Shadows**: Add new elevation classes following `.glass-*` pattern
5. **Components**: Create reusable components in `/src/components/` with clear APIs

### Maintenance Principles
1. **Consistency Over Creativity**: Follow established patterns unless there's a compelling reason to deviate
2. **Theme First**: Define design tokens in CSS variables before hardcoding values
3. **Component Composition**: Build complex UIs from simple, reusable primitives
4. **Document Usage**: Comment complex components with usage examples and prop types
5. **Performance Mindful**: Avoid unnecessary re-renders, use CSS for animations where possible
6. **Feedback Loops**: Regularly test with actual agent data and user scenarios

## Design Resources & References

### Tools & Libraries
- **Tailwind CSS**: Utility-first framework for rapid UI development
- **Framer Motion**: Animation library for React with spring physics
- **Lucide React**: Consistent icon set with medical/technical focus
- **Sonner**: Toast notification system with customizable styling
- **@dnd-kit**: Accessible drag-and-drop toolkit for Kanban and sorting

### Design Inspirations
- **Glassmorphism**: Apple's macOS Big Sur/Monterey design language
- **Modern Dashboard**: Clean, data-focused administrative interfaces
- **Developer Tools**: IDE-inspired layouts with contextual panels
- **AI Agent Interfaces**: Forward-looking designs for human-AI collaboration

### Future Considerations
1. **Theme Customization**: User-configurable themes beyond light/dark
2. **Animation Scale**: Respect system preferences for reduced motion
3. **High Contrast Mode**: Enhanced accessibility for visually impaired users
4. **Internationalization**: Layout considerations for RTL languages
5. **Dark Mode Refinement**: Continued improvement of dark theme experience