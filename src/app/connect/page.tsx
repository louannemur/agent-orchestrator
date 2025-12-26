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
            {/* Prerequisites */}
            <div className="rounded-lg border border-neutral-800 bg-black p-5">
              <h2 className="mb-4 text-sm font-medium text-white">
                Before You Start
              </h2>
              <p className="mb-4 text-sm text-neutral-400">
                Install Claude Code CLI to run tasks without an API key:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    1
                  </span>
                  <div>
                    <p className="text-sm text-neutral-300">Install the CLI</p>
                    <code className="mt-1.5 block rounded bg-neutral-900 px-3 py-2 font-mono text-xs text-emerald-400">
                      npm install -g @anthropic-ai/claude-code
                    </code>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    2
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
                Don&apos;t have Claude Code? Use an{" "}
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

            {/* Command Box */}
            <div className="rounded-lg border border-neutral-800 bg-black">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
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
            </div>

            {/* Timer and Regenerate */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">
                {expiresIn > 0 ? (
                  <>Expires in {formatTime(expiresIn)}</>
                ) : (
                  <span className="text-amber-500">Token expired</span>
                )}
              </span>
              <button
                onClick={generateToken}
                className="flex items-center gap-2 rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>

            {/* Steps */}
            <div className="rounded-lg border border-neutral-800 bg-black p-5">
              <h2 className="mb-4 text-sm font-medium text-white">
                What happens next?
              </h2>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">Run the command</p>
                    <p className="text-sm text-neutral-500">
                      Open your terminal and paste the command above
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Choose your project directory
                    </p>
                    <p className="text-sm text-neutral-500">
                      Select where the agent will work on tasks
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-neutral-400">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      You&apos;re connected!
                    </p>
                    <p className="text-sm text-neutral-500">
                      The runner will start processing tasks automatically
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
