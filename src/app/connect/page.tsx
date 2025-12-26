"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  RefreshCw,
  Terminal,
  ArrowLeft,
  Sparkles,
  Clock,
} from "lucide-react";

export default function ConnectPage() {
  const [command, setCommand] = useState<string>("");
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const generateToken = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/connect");
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || "Failed to generate token");
      }

      setCommand(json.data.command);
      setExpiresIn(json.data.expiresIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateToken();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (expiresIn <= 0) return;

    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresIn]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = command;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Background gradient */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />

      <div className="relative mx-auto max-w-2xl px-4 py-16">
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-2 text-[13px] text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Dashboard
        </Link>

        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-500/10 px-3 py-1 text-[11px] font-medium text-accent-400 border border-accent-500/20">
            <Sparkles className="h-3 w-3" />
            Connect Runner
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Connect Your Machine
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
            Run the command below in your terminal to connect this machine as an
            agent runner.
          </p>
        </div>

        {error ? (
          <div className="relative overflow-hidden rounded-2xl bg-red-500/5 p-6 border border-red-500/20">
            <p className="text-[14px] text-red-400">{error}</p>
            <button
              onClick={generateToken}
              className="mt-4 rounded-xl bg-red-500 px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-accent-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Prerequisites */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04]">
              <div className="absolute inset-0 rounded-2xl border border-accent-500/20" />
              <div className="absolute inset-0 bg-gradient-to-br from-accent-500/5 to-transparent" />

              <div className="relative">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Before You Start
                </h2>
                <p className="mb-5 text-[13px] text-zinc-400">
                  Install Claude Code CLI to run tasks without an API key:
                </p>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-500/20 text-[11px] font-medium text-accent-400">
                      1
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] text-zinc-300">Install the CLI</p>
                      <code className="mt-2 block rounded-lg bg-surface-900 px-3 py-2 font-mono text-[12px] text-emerald-400 border border-white/[0.06]">
                        npm install -g @anthropic-ai/claude-code
                      </code>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-500/20 text-[11px] font-medium text-accent-400">
                      2
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] text-zinc-300">
                        Log in with your Anthropic account
                      </p>
                      <code className="mt-2 block rounded-lg bg-surface-900 px-3 py-2 font-mono text-[12px] text-emerald-400 border border-white/[0.06]">
                        claude login
                      </code>
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-[11px] text-zinc-600">
                  Don&apos;t have Claude Code? You can also use an{" "}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-400 hover:text-accent-300 transition-colors"
                  >
                    Anthropic API key
                  </a>{" "}
                  instead.
                </p>
              </div>
            </div>

            {/* Command Box */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] transition-all duration-300 hover:bg-white/[0.04]">
              <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-zinc-500" />
                    <span className="text-[13px] text-zinc-500">Terminal</span>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                      copied
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] border border-transparent"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <code className="block break-all font-mono text-[13px] text-emerald-400 leading-relaxed">
                    {command}
                  </code>
                </div>
              </div>
            </div>

            {/* Timer and Regenerate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px]">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                {expiresIn > 0 ? (
                  <span className="text-zinc-500">
                    Expires in{" "}
                    <span className="font-medium text-zinc-400">
                      {formatTime(expiresIn)}
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-400">Token expired</span>
                )}
              </div>
              <button
                onClick={generateToken}
                className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.02] px-4 py-2 text-[13px] text-zinc-300 transition-all hover:bg-white/[0.06] hover:border-white/[0.15]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>

            {/* Steps */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04]">
              <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

              <div className="relative">
                <h2 className="mb-5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  What happens next?
                </h2>
                <ol className="space-y-5">
                  <li className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-[12px] font-medium text-accent-400 border border-accent-500/20">
                      1
                    </span>
                    <div>
                      <p className="font-medium text-[14px] text-white">
                        Run the command
                      </p>
                      <p className="mt-1 text-[13px] text-zinc-500">
                        Open your terminal and paste the command above
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-[12px] font-medium text-accent-400 border border-accent-500/20">
                      2
                    </span>
                    <div>
                      <p className="font-medium text-[14px] text-white">
                        Choose your project directory
                      </p>
                      <p className="mt-1 text-[13px] text-zinc-500">
                        Select where the agent will work on tasks
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-[12px] font-medium text-emerald-400 border border-emerald-500/20">
                      3
                    </span>
                    <div>
                      <p className="font-medium text-[14px] text-white">
                        You&apos;re connected!
                      </p>
                      <p className="mt-1 text-[13px] text-zinc-500">
                        The runner will start processing tasks automatically
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
