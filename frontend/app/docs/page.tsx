"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Cog,
  FileText,
  LayoutPanelTop,
  Monitor,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Wrench,
} from "lucide-react";

const sections = [
  {
    id: "about",
    index: "01",
    title: "About the Project",
    description: "What the app does, who it serves, and why it matters.",
    icon: BookOpen,
  },
  {
    id: "flow",
    index: "02",
    title: "How It Works",
    description: "From chat export to an explorable knowledge base.",
    icon: LayoutPanelTop,
  },
  {
    id: "features",
    index: "03",
    title: "Features Overview",
    description: "Core capabilities built for search, insight, and recall.",
    icon: Sparkles,
  },
  {
    id: "setup",
    index: "04",
    title: "Local Setup Guide",
    description: "Run the full stack locally for development or testing.",
    icon: Monitor,
  },
  {
    id: "env",
    index: "05",
    title: "Environment Variables",
    description: "What to configure before you process chats.",
    icon: Cog,
  },
  {
    id: "troubleshooting",
    index: "06",
    title: "Troubleshooting",
    description: "Fix the most common setup and processing issues quickly.",
    icon: Wrench,
  },
] as const;

const featureCards = [
  {
    title: "Knowledge graph exploration",
    description: "See how people, files, links, and topics connect inside a visual graph so you can navigate context instead of raw chronology.",
    icon: BrainCircuit,
  },
  {
    title: "Search that matches memory",
    description: "Find content with plain keywords, semantic matches, and structured filters across links, media, documents, and important messages.",
    icon: Search,
  },
  {
    title: "Private local-first processing",
    description: "Your exports are analyzed on your machine so sensitive conversations stay local while still unlocking AI-assisted organization.",
    icon: ShieldCheck,
  },
  {
    title: "Structured message intelligence",
    description: "Messages are classified, clustered into topics, enriched with previews, and transformed into reusable knowledge instead of buried chat history.",
    icon: FileText,
  },
] as const;

const setupSteps = [
  "Install Python 3.11+ and Node.js 20+ on your machine.",
  "Create a backend virtual environment and install backend requirements.",
  "Install frontend dependencies inside the frontend directory.",
  "Copy the sample environment file and fill in required API keys if needed.",
  "Run the backend server first, then start the Next.js frontend.",
  "Open the docs or upload flow in the browser and test with a sample export.",
] as const;

const envVars = [
  {
    name: "DATABASE_URL",
    description: "Points the backend to the local SQLite database or another configured database target.",
  },
  {
    name: "GEMINI_API_KEY",
    description: "Enables AI-assisted labeling or enrichment where the backend expects Gemini access.",
  },
  {
    name: "CORS_ORIGINS",
    description: "Defines which frontend origins are allowed to talk to the backend during local development.",
  },
] as const;

const issueList = [
  {
    title: "Upload does not start",
    description: "Check backend availability, confirm the file type is supported, and verify the browser can reach the API origin.",
  },
  {
    title: "Processing stalls mid-pipeline",
    description: "Inspect backend logs, validate Python dependencies, and ensure the exported chat contains the expected text file structure.",
  },
  {
    title: "No AI labels or summaries",
    description: "Verify your Gemini key is present in the backend environment and restart the API after updating variables.",
  },
  {
    title: "Media previews are missing",
    description: "Use the ZIP export with included media and confirm the media files were extracted alongside the chat log.",
  },
] as const;

const themedScrollbarStyles = {
  scrollbarWidth: "thin",
  scrollbarColor: "rgba(78, 88, 94, 0.9) rgba(255, 255, 255, 0.04)",
} satisfies CSSProperties;

function SectionShell({
  id,
  index,
  title,
  eyebrow,
  children,
}: {
  id: string;
  index: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm md:p-8"
    >
      <div className="mb-8 flex flex-col gap-4 border-b border-white/8 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-300/80">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
        </div>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-emerald-300">
          {index}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>(sections[0].id);

  const observerIds = useMemo(() => sections.map((section) => section.id), []);

  useEffect(() => {
    const elements = observerIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries.length > 0) {
          setActiveSection(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0.2, 0.35, 0.5, 0.7],
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [observerIds]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 mesh-gradient opacity-50 pointer-events-none" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      <nav className="sticky top-0 z-30 border-b border-white/8 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/app/upload"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/12 px-5 text-sm font-medium text-emerald-100 transition-all duration-200 hover:border-emerald-300/35 hover:bg-emerald-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <Upload className="h-4 w-4" />
            Upload Chat Export
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-14">
        <section className="grid gap-8 border-b border-white/8 pb-10 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] md:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
              Product documentation
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Navigate the product like a system, not a long page.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                This guide explains what WhatsApp Knowledge Extractor does, how the pipeline works,
                how to run it locally, and how to troubleshoot common issues. The left rail stays
                fixed so you can jump between sections while the content area scrolls independently.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="text-sm text-muted-foreground">Format support</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">ZIP and TXT exports</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Import complete chat exports with media or process text-only logs for faster iteration.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="text-sm text-muted-foreground">Processing model</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Local-first intelligence</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Parse, classify, cluster, index, and visualize your data without sending raw chats to a hosted service.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[290px_minmax(0,1fr)] xl:gap-12">
          <aside className="lg:sticky lg:top-24 lg:h-[calc(100dvh-7rem)]">
            <div className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
              <div className="border-b border-white/8 px-3 pb-4">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-300/80">Contents</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">Documentation map</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Select a section to jump directly into the guide. The current section stays highlighted as you scroll.
                </p>
              </div>

              <nav
                className="mt-4 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(78,88,94,0.9)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/80 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500/85"
                style={themedScrollbarStyles}
              >
                <ul className="space-y-2">
                  {sections.map((section) => {
                    const isActive = activeSection === section.id;
                    const Icon = section.icon;

                    return (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className={`group flex min-h-11 items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                            isActive
                              ? "border-emerald-400/25 bg-emerald-400/10 text-foreground"
                              : "border-transparent bg-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.04] hover:text-foreground"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                              isActive
                                ? "border-emerald-400/20 bg-emerald-400/14 text-emerald-200"
                                : "border-white/8 bg-white/[0.04] text-muted-foreground group-hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/70">
                                {section.index}
                              </span>
                              <ChevronRight
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  isActive ? "translate-x-0 text-emerald-200" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                                }`}
                              />
                            </div>
                            <p className="mt-1 text-sm font-medium leading-6 text-current">{section.title}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{section.description}</p>
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </aside>

          <div
            className="space-y-6 lg:h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(78,88,94,0.9)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/80 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding hover:[&::-webkit-scrollbar-thumb]:bg-zinc-500/85"
            style={themedScrollbarStyles}
          >
            <SectionShell id="about" index="01" title="About the Project" eyebrow="Overview">
              <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-4 text-base leading-7 text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">WhatsApp Knowledge Extractor</span> turns noisy,
                    unstructured WhatsApp exports into a structured knowledge surface you can browse,
                    search, and understand. Instead of endlessly scrolling through old messages, you get
                    organized content views, topic clusters, analytics, and a navigable graph of shared context.
                  </p>
                  <p>
                    It is designed for people who already use WhatsApp as an informal archive for notes,
                    links, media, reminders, and shared resources. The product helps convert that passive archive
                    into something closer to a personal research workspace.
                  </p>
                  <p>
                    The biggest value is retrieval. Once a chat is processed, messages become easier to search by
                    type, topic, importance, and semantic meaning rather than only by time.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-background/50 p-5">
                  <p className="text-sm font-medium text-foreground">Best suited for</p>
                  <ul className="mt-4 space-y-3">
                    {[
                      "Personal saved-message style archives",
                      "Small team or family group coordination",
                      "Students and researchers sharing learning material",
                      "Professionals collecting links, PDFs, and references",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SectionShell>

            <SectionShell id="flow" index="02" title="How It Works" eyebrow="Workflow">
              <div className="space-y-4">
                {[
                  {
                    title: "Export your chat from WhatsApp",
                    description:
                      "Create a ZIP export with media for the richest experience, or use a TXT-only export for text-focused processing.",
                    icon: Smartphone,
                  },
                  {
                    title: "Upload the export into the app",
                    description:
                      "Use the upload flow to send your file into the local pipeline. Large chat histories are supported for deep archives.",
                    icon: Upload,
                  },
                  {
                    title: "Let the pipeline enrich the data",
                    description:
                      "The backend parses messages, identifies content types, extracts useful metadata, generates embeddings, clusters topics, and prepares search indexes.",
                    icon: BrainCircuit,
                  },
                  {
                    title: "Explore the resulting knowledge base",
                    description:
                      "Open the dashboard to inspect messages, media, topics, important items, stats, and graph relationships in one place.",
                    icon: Monitor,
                  },
                ].map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.title}
                      className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[auto_1fr]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/70">
                            Step {idx + 1}
                          </span>
                          <h3 className="text-lg font-medium tracking-tight text-foreground">{step.title}</h3>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionShell>

            <SectionShell id="features" index="03" title="Features Overview" eyebrow="Capabilities">
              <div className="grid gap-4 md:grid-cols-2">
                {featureCards.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-lg font-medium tracking-tight text-foreground">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </SectionShell>

            <SectionShell id="setup" index="04" title="Local Setup Guide" eyebrow="Development">
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.5rem] border border-white/10 bg-background/50 p-5">
                  <p className="text-sm font-medium text-foreground">Recommended flow</p>
                  <ol className="mt-4 space-y-4">
                    {setupSteps.map((step, idx) => (
                      <li key={step} className="flex items-start gap-4 text-sm leading-6 text-muted-foreground">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-xs font-semibold text-emerald-200">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Frontend</p>
                    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 font-mono text-sm text-emerald-200">
                      npm install
                      <br />
                      npm run dev
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Backend</p>
                    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 font-mono text-sm text-emerald-200">
                      pip install -r requirements.txt
                      <br />
                      uvicorn app.main:app --reload
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Adjust the exact backend start command if your project uses a different entrypoint or a virtual environment workflow.
                  </p>
                </div>
              </div>
            </SectionShell>

            <SectionShell id="env" index="05" title="Environment Variables" eyebrow="Configuration">
              <div className="space-y-4">
                {envVars.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6"
                  >
                    <div className="font-mono text-sm text-emerald-200">{item.name}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground md:mt-0">{item.description}</p>
                  </div>
                ))}
                <div className="rounded-[1.5rem] border border-amber-400/15 bg-amber-400/10 p-5 text-sm leading-6 text-amber-50/85">
                  Keep your API keys and environment files local. Do not commit secrets or production credentials into the repository.
                </div>
              </div>
            </SectionShell>

            <SectionShell id="troubleshooting" index="06" title="Troubleshooting" eyebrow="Support">
              <div className="space-y-4">
                {issueList.map((item) => (
                  <div key={item.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="text-lg font-medium tracking-tight text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </SectionShell>

            <section className="rounded-[2rem] border border-emerald-400/15 bg-emerald-400/10 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-200/80">Next step</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    Ready to process your first export?
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Start with a ZIP export that includes media for the most complete view of your knowledge base.
                  </p>
                </div>
                <Link
                  href="/app/upload"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-300/20 bg-background/70 px-6 py-3 text-sm font-medium text-foreground transition-all duration-200 hover:border-emerald-300/35 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  <Upload className="h-4 w-4" />
                  Upload Chat Export
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
