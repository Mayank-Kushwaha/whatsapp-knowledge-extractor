"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
} from "lucide-react";
import { uploadChat, createProgressStream, PIPELINE_STEPS, getChat } from "@/lib/api";
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

    if (stepsComplete >= 10 || data?.status === "ready" || data?.status === "complete") {
      status = "done";
    } else if (step <= stepsComplete) {
      status = "done";
    } else if (step === stepNum) {
      status = hasError ? "error" : "active";
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

export default function UploadPage() {
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
  const eventSourceRef = useRef<EventSource | null>(null);

  const startTrackingProgress = useCallback((chatId: number, initial?: ProgressPayload) => {
    setActiveChatId(chatId);
    setProcessing(true);
    setCompleted(false);

    const initialPayload = initial ?? {
      current_step: 1,
      steps_complete: 0,
      steps_total: 10,
      status: "processing",
    };

    setSteps(buildStepsFromProgress(initialPayload));
    setUploadState({
      isUploading: true,
      chatId,
      progress: {
        step: initialPayload.current_step ?? initialPayload.step ?? 1,
        step_name:
          initialPayload.step_name ||
          PIPELINE_STEPS[initialPayload.current_step ?? initialPayload.step ?? 1] ||
          "Parsing messages",
        steps_total: initialPayload.steps_total || 10,
        status: initialPayload.status || "processing",
      },
    });

    eventSourceRef.current?.close();
    const es = createProgressStream(chatId);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressPayload = JSON.parse(event.data);

        if (data.status === "error") {
          setError(data.error || "Pipeline error occurred");
          setProcessing(false);
          setSteps(buildStepsFromProgress({ ...data, status: "error" }));
          resetUploadState();
          es.close();
          eventSourceRef.current = null;
          return;
        }

        const normalizedProgress = {
          step: data.current_step ?? data.step ?? 1,
          step_name:
            data.step_name ||
            PIPELINE_STEPS[data.current_step ?? data.step ?? 1] ||
            `Step ${data.current_step ?? data.step ?? 1}`,
          steps_total: data.steps_total || 10,
          status: data.status || "processing",
        };

        setSteps(buildStepsFromProgress(data));
        setUploadState({
          isUploading: normalizedProgress.status !== "ready" && normalizedProgress.status !== "complete",
          chatId,
          progress: normalizedProgress,
        });

        if (data.status === "ready" || data.status === "complete") {
          setCompleted(true);
          setProcessing(false);
          setSteps(buildStepsFromProgress({ ...data, steps_complete: 10, status: "ready" }));
          resetUploadState();
          es.close();
          eventSourceRef.current = null;

          setTimeout(() => {
            router.push(`/app/chats/${chatId}`);
          }, 1500);
        }
      } catch {
        // Ignore parse errors from SSE
      }
    };

    es.onerror = () => {
      setTimeout(async () => {
        try {
          const chat = await getChat(chatId);
          if (chat.status === "ready") {
            setCompleted(true);
            setProcessing(false);
            setSteps(buildStepsFromProgress({ current_step: 10, steps_complete: 10, status: "ready" }));
            resetUploadState();
            router.push(`/app/chats/${chatId}`);
          }
        } catch {
          // ignore
        }
      }, 2000);

      es.close();
      eventSourceRef.current = null;
    };
  }, [resetUploadState, router, setUploadState]);

  useEffect(() => {
    if (isUpdateMode && updateChatId && isUploading && uploadChatId === updateChatId && uploadProgress) {
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

      setActiveChatId(updateChatId);
      setProcessing(true);
      setCompleted(uploadProgress.status === "ready" || uploadProgress.status === "complete");
      setSteps(buildStepsFromProgress(derived));

      if (!eventSourceRef.current) {
        startTrackingProgress(updateChatId, derived);
      }
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [isUpdateMode, updateChatId, isUploading, uploadChatId, uploadProgress, startTrackingProgress]);

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
