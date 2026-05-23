"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";
import { uploadChat, PIPELINE_STEPS, getChat } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProgressPayload = {
  step?: number;
  current_step?: number;
  step_name?: string;
  steps_complete?: number;
  steps_total?: number;
  status?: string;
  error?: string;
};

interface PipelineStep {
  step: number;
  name: string;
  status: "pending" | "active" | "done" | "error";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStepsFromProgress(data?: ProgressPayload): PipelineStep[] {
  const stepNum = Math.max(1, Math.min(data?.current_step ?? data?.step ?? 1, 10));
  const stepsComplete = typeof data?.steps_complete === "number"
    ? Math.max(0, Math.min(data.steps_complete, 10))
    : Math.max(stepNum - 1, 0);
  const hasError = data?.status === "error";

  return Object.entries(PIPELINE_STEPS).map(([num, name]) => {
    const step = parseInt(num, 10);
    let status: PipelineStep["status"] = "pending";

    if (data?.status === "ready" || data?.status === "complete") {
      status = "done";
    } else if (hasError && step === stepNum) {
      status = "error";
    } else if (step <= stepsComplete) {
      status = "done";
    } else if (step === stepNum || step === stepsComplete + 1) {
      status = "active";
    }

    return { step, name, status };
  });
}

function getProgressPercent(steps: PipelineStep[], completed: boolean): number {
  if (completed) return 100;
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.status === "done").length / steps.length) * 100);
}

// ---------------------------------------------------------------------------
// Upload Page
// ---------------------------------------------------------------------------

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateChatIdParam = searchParams.get("chatId");
  const updateChatId = updateChatIdParam ? parseInt(updateChatIdParam, 10) : null;
  const isUpdateMode = Number.isFinite(updateChatId);

  const {
    setUploadState,
    resetUploadState,
    isUploading,
    uploadChatId,
    uploadProgress,
  } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [completed, setCompleted] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const progressPollRef = useRef<number | null>(null);
  const redirectedRef = useRef(false);

  const startTrackingProgress = useCallback((chatId: number, initial?: ProgressPayload) => {
    const stopPolling = () => {
      if (progressPollRef.current) {
        window.clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
    };

    const finalizeProgress = (targetChatId: number) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      setCompleted(true);
      setProcessing(false);
      setSteps(buildStepsFromProgress({ current_step: 10, steps_complete: 10, status: "ready" }));
      resetUploadState();
      stopPolling();

      setTimeout(() => {
        router.push(`/app/chats/${targetChatId}`);
      }, 300);
    };

    const failProgress = (message: string, data?: ProgressPayload) => {
      setError(message);
      setProcessing(false);
      setCompleted(false);
      setSteps(buildStepsFromProgress({ ...(data ?? {}), status: "error" }));
      resetUploadState();
      stopPolling();
    };

    const applyProgress = (data: ProgressPayload) => {
      const normalizedProgress = {
        step: data.current_step ?? data.step ?? 1,
        step_name:
          data.step_name ||
          PIPELINE_STEPS[data.current_step ?? data.step ?? 1] ||
          `Step ${data.current_step ?? data.step ?? 1}`,
        steps_total: data.steps_total || 10,
        status: data.status || "processing",
      };

      setActiveChatId(chatId);
      setProcessing(normalizedProgress.status !== "ready" && normalizedProgress.status !== "complete");
      setCompleted(normalizedProgress.status === "ready" || normalizedProgress.status === "complete");
      setSteps(buildStepsFromProgress({
        ...data,
        current_step: normalizedProgress.step,
        step_name: normalizedProgress.step_name,
        steps_total: normalizedProgress.steps_total,
        status: normalizedProgress.status,
      }));
      setUploadState({
        isUploading: normalizedProgress.status !== "ready" && normalizedProgress.status !== "complete",
        chatId,
        progress: normalizedProgress,
      });

      if (normalizedProgress.status === "ready" || normalizedProgress.status === "complete") {
        finalizeProgress(chatId);
      }
    };

    const syncFromChat = async () => {
      try {
        const chat = await getChat(chatId);
        const pipeline = chat.pipeline;

        if (chat.status === "ready") {
          finalizeProgress(chatId);
          return;
        }

        if (chat.status === "error") {
          failProgress(pipeline?.error || "Pipeline error occurred", {
            current_step: pipeline?.current_step ?? initial?.current_step ?? 1,
            steps_complete: pipeline?.steps_complete ?? initial?.steps_complete ?? 0,
            steps_total: pipeline?.steps_total ?? initial?.steps_total ?? 10,
            status: "error",
          });
          return;
        }

        if (pipeline) {
          applyProgress({
            current_step: pipeline.current_step,
            steps_complete: pipeline.steps_complete,
            steps_total: pipeline.steps_total,
            status: chat.status,
            step_name: PIPELINE_STEPS[pipeline.current_step] || `Step ${pipeline.current_step}`,
          });
        }
      } catch {
        // ignore polling errors
      }
    };

    redirectedRef.current = false;
    setActiveChatId(chatId);
    setProcessing(true);
    setCompleted(false);

    const initialPayload = initial ?? {
      current_step: 1,
      steps_complete: 0,
      steps_total: 10,
      status: "processing",
    };

    applyProgress(initialPayload);

    stopPolling();
    progressPollRef.current = window.setInterval(() => {
      void syncFromChat();
    }, 1000);
    void syncFromChat();
  }, [resetUploadState, router, setUploadState]);

  useEffect(() => {
    if (!isUpdateMode || !updateChatId || !isUploading || uploadChatId !== updateChatId || !uploadProgress) {
      return;
    }

    const derived: ProgressPayload = {
      step: uploadProgress.step,
      step_name: uploadProgress.step_name,
      steps_total: uploadProgress.steps_total,
      status: uploadProgress.status,
      current_step: uploadProgress.step,
      steps_complete:
        uploadProgress.status === "ready" || uploadProgress.status === "complete"
          ? 10
          : Math.max((uploadProgress.step || 1) - 1, 0),
    };

    if (!progressPollRef.current) {
      startTrackingProgress(updateChatId, derived);
    }
  }, [isUpdateMode, updateChatId, isUploading, uploadChatId, uploadProgress, startTrackingProgress]);

  useEffect(() => {
    return () => {
      if (progressPollRef.current) {
        window.clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext !== "txt" && ext !== "zip") {
        setError("Only .txt and .zip files are supported");
        return;
      }
      setFile(f);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/zip": [".zip"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadChat(file, {
        chatId: isUpdateMode ? updateChatId ?? undefined : undefined,
      });

      setUploading(false);
      startTrackingProgress(result.chat_id);
    } catch (err) {
      setUploading(false);
      setProcessing(false);
      setError(err instanceof Error ? err.message : "Upload failed");
      resetUploadState();
    }
  };

  const showingTrackedProgress = processing || completed || (!!activeChatId && activeChatId === updateChatId);
  const progress = getProgressPercent(steps, completed);
  const FileIcon = file?.name.endsWith(".zip") ? FileArchive : FileText;

  return (
    <div className="flex items-center justify-center min-h-full p-6">
      <div className="w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold tracking-tight">
            {isUpdateMode ? "Update Chat Export" : "Upload Chat Export"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isUpdateMode ? "Upload the latest WhatsApp export to replace this chat dashboard." : "Drop your WhatsApp "}
            {!isUpdateMode && <code className="text-xs px-1.5 py-0.5 rounded bg-white/5 font-mono">.txt</code>}
            {!isUpdateMode && " or "}
            {!isUpdateMode && <code className="text-xs px-1.5 py-0.5 rounded bg-white/5 font-mono">.zip</code>}
            {!isUpdateMode && " export"}
          </p>
        </motion.div>

        {/* Privacy / AI disclosure — only show on first upload, not in update mode. */}
        {!isUpdateMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-100">
                  Heads up: this hosted version uses Google&apos;s Gemini API for
                  semantic embeddings and topic labels.
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Your chat content is sent to Gemini for processing. If you&apos;d
                  rather keep everything on your own machine — embeddings via a
                  local sentence-transformers model, no third-party API calls —
                  fork the repo and run it locally.
                </p>
                <a
                  href="https://github.com/Mayank-Kushwaha/whatsapp-knowledge-extractor.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 text-foreground transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.16c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 2.87-.39c.97 0 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.15v3.19c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                  </svg>
                  Fork on GitHub
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!showingTrackedProgress ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <div
                {...getRootProps()}
                className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? "border-blue-500/60 bg-blue-500/5"
                    : file
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/4"
                }`}
              >
                <input {...getInputProps()} />

                <AnimatePresence mode="wait">
                  {file ? (
                    <motion.div
                      key="file-selected"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                          <FileIcon className="w-8 h-8 text-emerald-400" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile();
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30 transition-colors"
                        >
                          <X className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="drop-prompt"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <motion.div
                        animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                        className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center"
                      >
                        <Upload className={`w-7 h-7 ${isDragActive ? "text-blue-400" : "text-muted-foreground"}`} />
                      </motion.div>
                      <div>
                        <p className="text-sm font-medium">
                          {isDragActive ? "Drop it here!" : "Drag & drop your chat export"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          or click to browse • .txt or .zip files
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full mt-6 py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {isUpdateMode ? "Update Chat" : "Start Processing"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="progress"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-white/8 bg-card/50 backdrop-blur-xl p-8"
            >
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {completed ? "Processing complete!" : "Processing your chat..."}
                  </span>
                  <span className="text-sm text-muted-foreground">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      completed
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                        : "bg-gradient-to-r from-blue-500 to-purple-500"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {steps.map((step, i) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      step.status === "active"
                        ? "bg-blue-500/8 text-foreground"
                        : step.status === "done"
                          ? "text-muted-foreground"
                          : step.status === "error"
                            ? "text-red-400"
                            : "text-muted-foreground/50"
                    }`}
                  >
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {step.status === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : step.status === "active" ? (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      ) : step.status === "error" ? (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
                      )}
                    </div>
                    <span className={step.status === "active" ? "font-medium" : ""}>
                      {step.name}
                    </span>
                  </motion.div>
                ))}
              </div>

              <AnimatePresence>
                {completed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
                  >
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-emerald-300">
                      Chat processed successfully!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Redirecting to dashboard...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadPageContent />
    </Suspense>
  );
}
