"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Plus,
  Play,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Check,
  X,
  Code2,
  Globe,
  FileCode,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/confirm-modal";
import type {
  ExternalSkill,
  ExternalSkillParameter,
  ExternalSkillExecutionResult,
} from "@/types/skills";

interface SkillsTabProps {
  skills: ExternalSkill[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToggleSkill: (id: string, enabled?: boolean) => Promise<void>;
  onAddSkill: (skillData: any) => Promise<boolean>;
  onUpdateSkill: (id: string, updates: any) => Promise<boolean>;
  onDeleteSkill: (id: string) => Promise<boolean>;
  togglingId?: string | null;
}

export function SkillsTab({
  skills,
  loading,
  onRefresh,
  onToggleSkill,
  onAddSkill,
  onUpdateSkill,
  onDeleteSkill,
  togglingId,
}: SkillsTabProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<ExternalSkill | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<ExternalSkill["category"]>("Utility");
  const [formType, setFormType] = useState<ExternalSkill["type"]>("api");
  const [formEndpoint, setFormEndpoint] = useState("");
  const [formMethod, setFormMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">("GET");
  const [formHeaders, setFormHeaders] = useState("");
  const [formBodyTemplate, setFormBodyTemplate] = useState("");
  const [formLanguage, setFormLanguage] = useState<"javascript" | "python">("javascript");
  const [formCode, setFormCode] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formParameters, setFormParameters] = useState<ExternalSkillParameter[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Test Modal state
  const [testingSkill, setTestingSkill] = useState<ExternalSkill | null>(null);
  const [testArgs, setTestArgs] = useState<Record<string, any>>({});
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<ExternalSkillExecutionResult | null>(null);

  // Delete modal state
  const [skillToDelete, setSkillToDelete] = useState<ExternalSkill | null>(null);
  const [isDeletingSkill, setIsDeletingSkill] = useState(false);

  const handleConfirmDeleteSkill = async () => {
    if (!skillToDelete) return;
    setIsDeletingSkill(true);
    try {
      const ok = await onDeleteSkill(skillToDelete.id);
      if (ok) {
        toast.success(`Deleted skill "${skillToDelete.displayName}"`);
        setSkillToDelete(null);
      }
    } catch {
      toast.error("Failed to delete skill");
    } finally {
      setIsDeletingSkill(false);
    }
  };

  // Categories list
  const categories = ["All", "Finance", "Data and Web", "Developer", "Productivity", "Utility", "Communication"];

  const openCreateModal = () => {
    setEditingSkill(null);
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormCategory("Utility");
    setFormType("api");
    setFormEndpoint("https://api.example.com/data?query={{query}}");
    setFormMethod("GET");
    setFormHeaders("");
    setFormBodyTemplate("");
    setFormLanguage("javascript");
    setFormCode("// Use args.param to access passed inputs\nconsole.log(JSON.stringify({ result: args.input }));");
    setFormInstructions("");
    setFormParameters([
      { name: "query", type: "string", description: "Query parameter", required: true, default: "example" },
    ]);
    setShowModal(true);
  };

  const openEditModal = (skill: ExternalSkill) => {
    setEditingSkill(skill);
    setFormName(skill.name);
    setFormDisplayName(skill.displayName);
    setFormDescription(skill.description);
    setFormCategory(skill.category);
    setFormType(skill.type);
    setFormEndpoint(skill.endpoint || "");
    setFormMethod(skill.method || "GET");
    setFormHeaders(skill.headers ? JSON.stringify(skill.headers, null, 2) : "");
    setFormBodyTemplate(skill.bodyTemplate || "");
    setFormLanguage(skill.language || "javascript");
    setFormCode(skill.code || "");
    setFormInstructions(skill.instructions || "");
    setFormParameters(skill.parameters || []);
    setShowModal(true);
  };

  const handleAddParameter = () => {
    setFormParameters((prev) => [
      ...prev,
      { name: `param_${prev.length + 1}`, type: "string", description: "Parameter description", required: false },
    ]);
  };

  const handleUpdateParameter = (index: number, field: keyof ExternalSkillParameter, val: any) => {
    setFormParameters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleRemoveParameter = (index: number) => {
    setFormParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDisplayName.trim()) {
      toast.error("Please fill in the skill name and display name");
      return;
    }

    let parsedHeaders: Record<string, string> | undefined;
    if (formHeaders.trim()) {
      try {
        parsedHeaders = JSON.parse(formHeaders);
      } catch {
        toast.error("Headers must be valid JSON object format (e.g. {\"Authorization\": \"Bearer ...\"})");
        return;
      }
    }

    const payload = {
      name: formName.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
      displayName: formDisplayName.trim(),
      description: formDescription.trim(),
      category: formCategory,
      type: formType,
      enabled: editingSkill ? editingSkill.enabled : true,
      endpoint: formType === "api" ? formEndpoint.trim() : undefined,
      method: formType === "api" ? formMethod : undefined,
      headers: formType === "api" ? parsedHeaders : undefined,
      bodyTemplate: formType === "api" && (formMethod === "POST" || formMethod === "PUT") ? formBodyTemplate : undefined,
      language: formType === "script" ? formLanguage : undefined,
      code: formType === "script" ? formCode : undefined,
      instructions: formType === "instruction" ? formInstructions : undefined,
      parameters: formParameters.filter((p) => p.name.trim()),
    };

    setIsSubmitting(true);
    try {
      if (editingSkill) {
        const success = await onUpdateSkill(editingSkill.id, payload);
        if (success) {
          toast.success(`Skill "${payload.displayName}" updated successfully`);
          setShowModal(false);
        }
      } else {
        const success = await onAddSkill(payload);
        if (success) {
          toast.success(`Skill "${payload.displayName}" added to all agents!`);
          setShowModal(false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTestDrawer = (skill: ExternalSkill) => {
    setTestingSkill(skill);
    const initialArgs: Record<string, any> = {};
    skill.parameters.forEach((p) => {
      initialArgs[p.name] = p.default !== undefined ? p.default : "";
    });
    setTestArgs(initialArgs);
    setTestResult(null);
  };

  const runSkillTest = async () => {
    if (!testingSkill) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          skillId: testingSkill.id,
          args: testArgs,
        }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setTestResult(data.result);
        if (data.result.success) {
          toast.success(`Skill executed in ${data.result.latency}ms`);
        } else {
          toast.error(data.result.error || "Skill execution reported failure");
        }
      } else {
        setTestResult({
          success: false,
          output: null,
          error: data.error || "Failed to execute skill",
          latency: 0,
        });
        toast.error("Execution failed");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        output: null,
        error: err.message || "Network error",
        latency: 0,
      });
      toast.error("Test failed");
    } finally {
      setTestRunning(false);
    }
  };

  // Filter skills
  const filteredSkills = skills.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === "All" || s.category === selectedCategory;
    const matchType = selectedType === "All" || s.type === selectedType;
    return matchSearch && matchCategory && matchType;
  });

  const activeCount = skills.filter((s) => s.enabled).length;
  const apiCount = skills.filter((s) => s.type === "api").length;
  const scriptCount = skills.filter((s) => s.type === "script").length;

  return (
    <div className="space-y-6">
      {/* Action Strip */}
      <div className="flex items-center justify-end gap-2.5">
        <button
          onClick={() => onRefresh()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-medium text-foreground transition cursor-pointer disabled:opacity-50"
          title="Refresh skills"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh</span>
        </button>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Skill</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border/80 bg-card/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Skills</div>
          <div className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
            <span>{activeCount}</span>
            <span className="text-xs font-normal text-muted-foreground">/ {skills.length}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/80 bg-card/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">HTTP APIs</div>
          <div className="text-xl font-bold text-blue-500 mt-1">{apiCount}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/80 bg-card/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Custom Scripts</div>
          <div className="text-xl font-bold text-amber-500 mt-1">{scriptCount}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/80 bg-card/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Agent Access</div>
          <div className="text-xs font-bold text-emerald-500 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All Agents Global</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search external skills by name, description, or tool..."
            className="w-full bg-secondary/50 border border-border pl-9 pr-4 py-2 rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills & Type Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border/80">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-secondary/50 border border-border px-2.5 py-1.5 rounded-xl text-xs text-foreground outline-none cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="api">HTTP API</option>
            <option value="script">Script (JS/Python)</option>
            <option value="instruction">Instruction</option>
          </select>
        </div>
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
          <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No external skills found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {search || selectedCategory !== "All"
              ? "Try adjusting your search filters or add a new custom external skill."
              : "Install your first external skill to expand the real-time reasoning and execution abilities of all agents."}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Skill</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSkills.map((skill) => {
            const isToggling = togglingId === skill.id;
            const isExpanded = !!expandedDetails[skill.id];

            return (
              <div
                key={skill.id}
                className={`rounded-2xl border transition-all duration-200 bg-card p-5 space-y-4 shadow-xs relative ${
                  skill.enabled
                    ? "border-border hover:border-primary/40"
                    : "border-border/50 opacity-75 bg-card/60"
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        skill.type === "api"
                          ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          : skill.type === "script"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                      }`}
                    >
                      {skill.type === "api" ? (
                        <Globe className="w-4 h-4" />
                      ) : skill.type === "script" ? (
                        <Code2 className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground truncate">
                          {skill.displayName}
                        </h3>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/60">
                          {skill.category}
                        </span>
                        <span
                          className={`text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            skill.type === "api"
                              ? "bg-blue-500/15 text-blue-500"
                              : skill.type === "script"
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-purple-500/15 text-purple-500"
                          }`}
                        >
                          {skill.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <span className="text-primary font-semibold">`{skill.name}`</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(skill.name);
                            toast.success(`Copied tool identifier "${skill.name}"`);
                          }}
                          className="hover:text-foreground text-muted-foreground/60 transition cursor-pointer"
                          title="Copy tool name"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Enable/Disable Switch */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleSkill(skill.id, !skill.enabled)}
                      disabled={isToggling}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        skill.enabled ? "bg-primary" : "bg-secondary"
                      }`}
                      title={skill.enabled ? "Skill active for all agents" : "Skill disabled"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          skill.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {skill.description}
                </p>

                {/* Parameters Preview */}
                {skill.parameters && skill.parameters.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Parameters ({skill.parameters.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {skill.parameters.map((param) => (
                        <div
                          key={param.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/60 border border-border/60 text-[11px] font-mono text-foreground"
                          title={param.description}
                        >
                          <span className="font-semibold text-primary">{param.name}</span>
                          <span className="text-[9.5px] text-muted-foreground">:{param.type}</span>
                          {param.required && (
                            <span className="text-[9px] text-amber-500 font-bold">*</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expandable Configuration Details */}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDetails((prev) => ({ ...prev, [skill.id]: !prev[skill.id] }))
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    <span>{isExpanded ? "Hide Details" : "View Configuration"}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2.5 p-3 rounded-xl bg-secondary/30 border border-border/80 text-xs font-mono space-y-2 overflow-x-auto"
                      >
                        {skill.type === "api" && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 font-bold text-[10px]">
                                {skill.method || "GET"}
                              </span>
                              <span className="text-foreground break-all text-[11px]">
                                {skill.endpoint}
                              </span>
                            </div>
                            {skill.headers && Object.keys(skill.headers).length > 0 && (
                              <div className="text-[10px] text-muted-foreground pt-1">
                                Headers: {JSON.stringify(skill.headers)}
                              </div>
                            )}
                          </div>
                        )}

                        {skill.type === "script" && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">
                              Runtime: {skill.language}
                            </span>
                            <pre className="text-[10.5px] text-foreground p-2 rounded bg-background/50 border border-border/50 max-h-36 overflow-y-auto">
                              {skill.code}
                            </pre>
                          </div>
                        )}

                        {skill.type === "instruction" && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Prompt Guideline:</span>
                            <p className="text-[11px] text-foreground font-sans">
                              {skill.instructions}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-[10px] text-muted-foreground">
                    Available to: <strong className="text-foreground">All Agents</strong>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openTestDrawer(skill)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-xs font-semibold text-foreground transition cursor-pointer"
                      title="Test skill execution"
                    >
                      <Play className="w-3 h-3 text-emerald-500" />
                      <span>Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(skill)}
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                      title="Edit skill"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSkillToDelete(skill)}
                      className="p-1.5 rounded-lg border border-border text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete skill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl my-8 p-6 rounded-2xl border border-border bg-card shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {editingSkill ? "Edit External Skill" : "Add External Skill"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      This skill will be immediately accessible to all agents in Agent Studio.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                {/* Basic Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formDisplayName}
                      onChange={(e) => {
                        setFormDisplayName(e.target.value);
                        if (!editingSkill && !formName) {
                          setFormName(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]+/g, "_")
                              .slice(0, 30)
                          );
                        }
                      }}
                      placeholder="e.g. Live Crypto Price"
                      className="w-full bg-secondary/50 border border-border px-3 py-2 rounded-xl text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Tool Identifier <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) =>
                        setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))
                      }
                      placeholder="e.g. crypto_price"
                      className="w-full bg-secondary/50 border border-border px-3 py-2 rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Name invoked by LLM (snake_case, lowercase)
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Skill Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe what this skill does and when the agent should invoke it..."
                    className="w-full bg-secondary/50 border border-border p-3 rounded-xl text-xs text-foreground outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Category and Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full bg-secondary/50 border border-border px-3 py-2 rounded-xl text-xs text-foreground outline-none"
                    >
                      <option value="Finance">Finance</option>
                      <option value="Data and Web">Data and Web</option>
                      <option value="Developer">Developer</option>
                      <option value="Productivity">Productivity</option>
                      <option value="Utility">Utility</option>
                      <option value="Communication">Communication</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Execution Type
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-secondary/40 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => setFormType("api")}
                        className={`py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          formType === "api"
                            ? "bg-card text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        HTTP API
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormType("script")}
                        className={`py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          formType === "script"
                            ? "bg-card text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Script
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormType("instruction")}
                        className={`py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          formType === "instruction"
                            ? "bg-card text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Guideline
                      </button>
                    </div>
                  </div>
                </div>

                {/* Type Specific Fields */}
                {formType === "api" && (
                  <div className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-3">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span>REST API and Webhook Configuration</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-1">
                        <label className="text-[11px] text-muted-foreground block mb-1">Method</label>
                        <select
                          value={formMethod}
                          onChange={(e) => setFormMethod(e.target.value as any)}
                          className="w-full bg-secondary/60 border border-border px-2.5 py-2 rounded-xl text-xs text-foreground outline-none font-bold"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[11px] text-muted-foreground block mb-1">
                          Endpoint URL (use {"{{param}}"} placeholders)
                        </label>
                        <input
                          type="text"
                          required
                          value={formEndpoint}
                          onChange={(e) => setFormEndpoint(e.target.value)}
                          placeholder="https://api.coingecko.com/api/v3/simple/price?ids={{coin}}&vs_currencies=usd"
                          className="w-full bg-secondary/60 border border-border px-3 py-2 rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">
                        Headers (Optional JSON, e.g. {"{\"Authorization\": \"Bearer token\"}"})
                      </label>
                      <input
                        type="text"
                        value={formHeaders}
                        onChange={(e) => setFormHeaders(e.target.value)}
                        placeholder='{"Accept": "application/json"}'
                        className="w-full bg-secondary/60 border border-border px-3 py-2 rounded-xl text-xs font-mono text-foreground outline-none"
                      />
                    </div>

                    {(formMethod === "POST" || formMethod === "PUT") && (
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">
                          Body Template (Optional JSON with {"{{param}}"})
                        </label>
                        <textarea
                          rows={2}
                          value={formBodyTemplate}
                          onChange={(e) => setFormBodyTemplate(e.target.value)}
                          placeholder='{"query": "{{query}}", "limit": 10}'
                          className="w-full bg-secondary/60 border border-border p-2.5 rounded-xl text-xs font-mono text-foreground outline-none resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formType === "script" && (
                  <div className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Sandboxed Code Script</span>
                      </div>
                      <select
                        value={formLanguage}
                        onChange={(e) => setFormLanguage(e.target.value as any)}
                        className="bg-secondary/60 border border-border px-2 py-1 rounded-lg text-xs font-semibold text-foreground outline-none"
                      >
                        <option value="javascript">JavaScript (Node VM)</option>
                        <option value="python">Python</option>
                      </select>
                    </div>

                    <textarea
                      rows={6}
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="// Access passed inputs via args.<paramName>&#10;console.log(JSON.stringify({ result: args.param }));"
                      className="w-full bg-secondary/60 border border-border p-3 rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary resize-y"
                    />
                    <span className="text-[10.5px] text-muted-foreground block">
                      Tip: Arguments are provided in the `args` object. Print your result to stdout via `console.log()` or return a value.
                    </span>
                  </div>
                )}

                {formType === "instruction" && (
                  <div className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-2">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Specialized Tool Instructions</span>
                    </div>
                    <textarea
                      rows={4}
                      value={formInstructions}
                      onChange={(e) => setFormInstructions(e.target.value)}
                      placeholder="Provide strict guidelines for formatting, validation, or compliance that the agent must execute..."
                      className="w-full bg-secondary/60 border border-border p-3 rounded-xl text-xs text-foreground outline-none resize-none"
                    />
                  </div>
                )}

                {/* Parameters Section */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">Skill Parameters</span>
                      <p className="text-[11px] text-muted-foreground">
                        Define parameters the agent will supply when calling this skill.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddParameter}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Param</span>
                    </button>
                  </div>

                  {formParameters.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                      No parameters defined. The skill will be called with no arguments.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {formParameters.map((param, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40 border border-border/80 text-xs"
                        >
                          <input
                            type="text"
                            value={param.name}
                            onChange={(e) =>
                              handleUpdateParameter(
                                idx,
                                "name",
                                e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "")
                              )
                            }
                            placeholder="param_name"
                            className="w-28 bg-card border border-border px-2 py-1 rounded-lg text-xs font-mono text-foreground outline-none"
                          />

                          <select
                            value={param.type}
                            onChange={(e) => handleUpdateParameter(idx, "type", e.target.value)}
                            className="bg-card border border-border px-2 py-1 rounded-lg text-xs text-foreground outline-none"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                            <option value="object">object</option>
                          </select>

                          <input
                            type="text"
                            value={param.description}
                            onChange={(e) => handleUpdateParameter(idx, "description", e.target.value)}
                            placeholder="Description for LLM"
                            className="flex-1 min-w-0 bg-card border border-border px-2 py-1 rounded-lg text-xs text-foreground outline-none"
                          />

                          <label className="flex items-center gap-1 text-[11px] text-muted-foreground select-none shrink-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!param.required}
                              onChange={(e) => handleUpdateParameter(idx, "required", e.target.checked)}
                              className="rounded border-border text-primary"
                            />
                            <span>Req</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveParameter(idx)}
                            className="p-1 text-muted-foreground hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingSkill ? "Save Changes" : "Create Skill"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test Skill Drawer / Modal */}
      <AnimatePresence>
        {testingSkill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-2xl border border-border bg-card shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Test Skill: {testingSkill.displayName}
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground">`{testingSkill.name}`</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTestingSkill(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Arguments Input */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  Provide Test Arguments
                </span>

                {testingSkill.parameters.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    This skill does not take any arguments. Click "Run Test" below.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {testingSkill.parameters.map((param) => (
                      <div key={param.name}>
                        <label className="text-xs font-mono text-foreground block mb-1">
                          {param.name}
                          {param.required && <span className="text-amber-500 ml-1">*</span>}
                          <span className="text-[10px] text-muted-foreground ml-2">
                            ({param.description})
                          </span>
                        </label>
                        <input
                          type="text"
                          value={testArgs[param.name] ?? ""}
                          onChange={(e) =>
                            setTestArgs((prev) => ({ ...prev, [param.name]: e.target.value }))
                          }
                          placeholder={`Enter ${param.name}...`}
                          className="w-full bg-secondary/50 border border-border px-3 py-2 rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={runSkillTest}
                  disabled={testRunning}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Executing Skill...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Execute Skill Test</span>
                    </>
                  )}
                </button>
              </div>

              {/* Output Response */}
              {testResult && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      {testResult.success ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>Result Status: {testResult.success ? "Success" : "Failed"}</span>
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {testResult.latency}ms latency
                    </span>
                  </div>

                  {testResult.error && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                      {testResult.error}
                    </div>
                  )}

                  {testResult.output !== null && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-mono">Response Payload:</span>
                      <pre className="p-3 rounded-xl bg-secondary/50 border border-border text-[11px] font-mono text-foreground max-h-56 overflow-auto scrollbar-thin">
                        {typeof testResult.output === "object"
                          ? JSON.stringify(testResult.output, null, 2)
                          : String(testResult.output)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Skill Confirm Modal */}
      <ConfirmModal
        isOpen={!!skillToDelete}
        onClose={() => {
          if (!isDeletingSkill) setSkillToDelete(null);
        }}
        onConfirm={handleConfirmDeleteSkill}
        title="Delete Skill"
        description="Are you sure you want to permanently delete this tool skill?"
        itemTitle={skillToDelete?.displayName}
        dangerDetails="Agents assigned to this skill will no longer be able to execute its logic or call its parameters."
        confirmText="Delete Skill"
        variant="danger"
        loading={isDeletingSkill}
      />
    </div>
  );
}
