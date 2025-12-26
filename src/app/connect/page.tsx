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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Connect Your Machine</h1>
          <p className="mt-2 text-zinc-400">
            Run the command below in your terminal to connect this machine as an agent runner.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-red-400">{error}</p>
            <button
              onClick={generateToken}
              className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500 border-t-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Command Box */}
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm text-zinc-500">Terminal</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="p-4">
                <code className="block break-all font-mono text-sm text-green-400">
                  {command}
                </code>
              </div>
            </div>

            {/* Timer and Regenerate */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-500">
                {expiresIn > 0 ? (
                  <>Token expires in {formatTime(expiresIn)}</>
                ) : (
                  <span className="text-yellow-500">Token expired</span>
                )}
              </div>
              <button
                onClick={generateToken}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                Generate New Token
              </button>
            </div>

            {/* Steps */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold">What happens next?</h2>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-medium text-blue-400">
                    1
                  </span>
                  <div>
                    <p className="font-medium">Run the command</p>
                    <p className="text-sm text-zinc-400">
                      Open your terminal and paste the command above
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-medium text-blue-400">
                    2
                  </span>
                  <div>
                    <p className="font-medium">Choose your project directory</p>
                    <p className="text-sm text-zinc-400">
                      Select where the agent will work on tasks
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-medium text-blue-400">
                    3
                  </span>
                  <div>
                    <p className="font-medium">You&apos;re connected!</p>
                    <p className="text-sm text-zinc-400">
                      The runner will start processing tasks automatically
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* Requirements */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold">Requirements</h2>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">&#x2713;</span>
                  Node.js 18 or later
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">&#x2713;</span>
                  Claude Code CLI (recommended) or Anthropic API key
                </li>
              </ul>
              <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <p className="text-xs text-zinc-400">
                  <strong className="text-zinc-300">Using Claude Code CLI (no API key needed):</strong>
                </p>
                <code className="mt-1 block text-xs text-green-400">
                  npm install -g @anthropic-ai/claude-code && claude login
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
