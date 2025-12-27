"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, RefreshCw, Terminal, ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-xl px-4 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-white">
            Connect Your Machine
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Run the command below in your terminal to connect this machine as an
            agent runner.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-900 bg-red-950/50 p-4">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={generateToken}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Install CLI */}
            <div className="rounded-lg border border-neutral-800 bg-black p-5">
              <h2 className="mb-4 text-sm font-medium text-white">
                Step 1: Install the CLI
              </h2>
              <p className="mb-4 text-sm text-neutral-400">
                From the project root directory, install the CLI globally:
              </p>
              <div className="space-y-2">
                <code className="block rounded bg-neutral-900 px-3 py-2 font-mono text-xs text-emerald-400">
                  cd cli && npm install && npm run build && npm install -g .
                </code>
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                This installs the <code className="text-neutral-400">agent-orchestrator</code> command globally.
              </p>
            </div>

            {/* Step 2: Claude Code (optional) */}
            <div className="rounded-lg border border-neutral-800 bg-black p-5">
              <h2 className="mb-4 text-sm font-medium text-white">
                Step 2: Set Up Claude Code (Recommended)
              </h2>
              <p className="mb-4 text-sm text-neutral-400">
                Install Claude Code to run tasks without an API key:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    a
                  </span>
                  <div>
                    <p className="text-sm text-neutral-300">Install Claude Code</p>
                    <code className="mt-1.5 block rounded bg-neutral-900 px-3 py-2 font-mono text-xs text-emerald-400">
                      npm install -g @anthropic-ai/claude-code
                    </code>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    b
                  </span>
                  <div>
                    <p className="text-sm text-neutral-300">
                      Log in with your Anthropic account
                    </p>
                    <code className="mt-1.5 block rounded bg-neutral-900 px-3 py-2 font-mono text-xs text-emerald-400">
                      claude login
                    </code>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Skip this step if you prefer to use an{" "}
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-400 underline hover:text-white"
                >
                  Anthropic API key
                </a>{" "}
                instead.
              </p>
            </div>

            {/* Step 3: Connect - Command Box */}
            <div className="rounded-lg border border-neutral-800 bg-black">
              <div className="border-b border-neutral-800 px-5 py-4">
                <h2 className="text-sm font-medium text-white">
                  Step 3: Connect Your Machine
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Run this command in your terminal:
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-500">Terminal</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    copied
                      ? "bg-emerald-900/50 text-emerald-400"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
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
                <code className="block break-all font-mono text-sm text-emerald-400">
                  {command}
                </code>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
                <span className="text-sm text-neutral-500">
                  {expiresIn > 0 ? (
                    <>Expires in {formatTime(expiresIn)}</>
                  ) : (
                    <span className="text-amber-500">Token expired</span>
                  )}
                </span>
                <button
                  onClick={generateToken}
                  className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>
            </div>

            {/* Step 4: Start */}
            <div className="rounded-lg border border-neutral-800 bg-black p-5">
              <h2 className="mb-4 text-sm font-medium text-white">
                Step 4: Start the Agent
              </h2>
              <p className="mb-4 text-sm text-neutral-400">
                After connecting, start the agent to begin processing tasks:
              </p>
              <code className="block rounded bg-neutral-900 px-3 py-2 font-mono text-xs text-emerald-400">
                agent-orchestrator start
              </code>
              <p className="mt-4 text-xs text-neutral-500">
                The agent will poll for new tasks and execute them in your chosen working directory.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
