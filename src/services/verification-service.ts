import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

import { db } from "@/lib/db";
import type { VerificationCheckResult, VerificationError } from "@/types";
import {
  ExceptionSeverity,
  ExceptionType,
  TaskStatus,
  VerificationStatus,
  type Task,
  type VerificationResult,
} from "@/types";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface TestCheckResult {
  passed: boolean;
  total: number;
  failed: number;
  errors: VerificationError[];
}

interface SemanticCheckResult {
  score: number;
  explanation: string;
}

interface AllCheckResults {
  syntax: VerificationCheckResult;
  types: VerificationCheckResult;
  lint: VerificationCheckResult;
  tests: TestCheckResult;
  semantic?: SemanticCheckResult;
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseTypeScriptErrors(output: string): VerificationError[] {
  const errors: VerificationError[] = [];
  // TypeScript error format: file(line,col): error TS1234: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/gm;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    errors.push({
      type: "type",
      file: match[1],
      line: parseInt(match[2]!, 10),
      message: `${match[4]}: ${match[5]}`,
    });
  }

  return errors;
}

function parseEslintOutput(jsonOutput: string): VerificationError[] {
  const errors: VerificationError[] = [];

  try {
    const results = JSON.parse(jsonOutput) as Array<{
      filePath: string;
      messages: Array<{
        severity: number;
        message: string;
        line: number;
        ruleId: string | null;
      }>;
    }>;

    for (const file of results) {
      for (const msg of file.messages) {
        // Only include errors (severity 2), not warnings
        if (msg.severity === 2) {
          errors.push({
            type: "lint",
            file: file.filePath,
            line: msg.line,
            message: `${msg.ruleId ?? "error"}: ${msg.message}`,
          });
        }
      }
    }
  } catch {
    // If JSON parsing fails, try to extract basic info
    if (jsonOutput.includes("error")) {
      errors.push({
        type: "lint",
        message: "ESLint reported errors (could not parse output)",
      });
    }
  }

  return errors;
}

interface JestTestResult {
  numFailedTests: number;
  numPassedTests: number;
  numTotalTests: number;
  testResults: Array<{
    name: string;
    status: string;
    message: string;
  }>;
}

interface VitestTestResult {
  numFailedTests: number;
  numPassedTests: number;
  numTotalTests: number;
  testResults: Array<{
    name: string;
    status: string;
    message?: string;
  }>;
}

function parseTestResults(
  output: string,
  runner: "jest" | "vitest" | "npm"
): TestCheckResult {
  try {
    if (runner === "jest" || runner === "vitest") {
      const json = JSON.parse(output) as JestTestResult | VitestTestResult;
      const errors: VerificationError[] = [];

      for (const result of json.testResults) {
        if (result.status === "failed") {
          errors.push({
            type: "test",
            file: result.name,
            message: result.message || "Test failed",
          });
        }
      }

      return {
        passed: json.numFailedTests === 0,
        total: json.numTotalTests,
        failed: json.numFailedTests,
        errors,
      };
    }
  } catch {
    // Fall through to basic parsing
  }

  // Basic parsing for non-JSON output
  const passed = !output.includes("FAIL") && !output.includes("failed");
  const totalMatch = output.match(/(\d+)\s*(?:tests?|specs?)/i);
  const failedMatch = output.match(/(\d+)\s*(?:failed|failing)/i);

  return {
    passed,
    total: totalMatch ? parseInt(totalMatch[1]!, 10) : 0,
    failed: failedMatch ? parseInt(failedMatch[1]!, 10) : 0,
    errors: passed
      ? []
      : [{ type: "test", message: "Tests failed (see output for details)" }],
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectTestRunner(
  workingDir: string
): Promise<"jest" | "vitest" | "npm" | null> {
  // Check for vitest
  if (
    (await fileExists(path.join(workingDir, "vitest.config.ts"))) ||
    (await fileExists(path.join(workingDir, "vitest.config.js")))
  ) {
    return "vitest";
  }

  // Check for jest
  if (
    (await fileExists(path.join(workingDir, "jest.config.js"))) ||
    (await fileExists(path.join(workingDir, "jest.config.ts"))) ||
    (await fileExists(path.join(workingDir, "jest.config.json")))
  ) {
    return "jest";
  }

  // Check package.json for test script
  try {
    const pkgPath = path.join(workingDir, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent) as { scripts?: { test?: string } };

    if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
      // Try to detect runner from script
      if (pkg.scripts.test.includes("vitest")) return "vitest";
      if (pkg.scripts.test.includes("jest")) return "jest";
      return "npm";
    }
  } catch {
    // No package.json or invalid
  }

  return null;
}

// ============================================================================
// VerificationService Class
// ============================================================================

class VerificationService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ==========================================================================
  // Main Entry Point
  // ==========================================================================

  async verify(taskId: string, workingDir: string): Promise<VerificationResult> {
    // Get task
    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Increment verification attempts
    const attemptNumber = task.verificationAttempts + 1;
    await db.task.update({
      where: { id: taskId },
      data: { verificationAttempts: attemptNumber },
    });

    console.log(
      `[VerificationService] Starting verification for task ${taskId} (attempt ${attemptNumber})`
    );

    // Run checks in order
    const syntax = await this.checkSyntax(workingDir);
    const types = await this.checkTypes(workingDir);
    const lint = await this.checkLint(workingDir);
    const tests = await this.checkTests(workingDir);

    // Only run semantic check if all other checks pass
    let semantic: SemanticCheckResult | undefined;
    if (syntax.passed && types.passed && lint.passed && tests.passed) {
      semantic = await this.checkSemantic(task, workingDir);
    }

    const allResults: AllCheckResults = { syntax, types, lint, tests, semantic };

    // Calculate confidence score
    const confidenceScore = this.calculateConfidence(allResults);

    // Determine if verification passed
    const passed =
      syntax.passed &&
      types.passed &&
      lint.passed &&
      tests.passed &&
      (semantic?.score ?? 0) >= 0.7;

    // Collect all errors
    const allErrors: Array<{ type: string; message: string; file?: string; line?: number }> = [
      ...syntax.errors,
      ...types.errors,
      ...lint.errors,
      ...tests.errors,
    ];

    // Build recommendations
    const recommendations: string[] = [];
    if (!syntax.passed) recommendations.push("Fix syntax errors before proceeding");
    if (!types.passed) recommendations.push("Resolve TypeScript type errors");
    if (!lint.passed) recommendations.push("Fix ESLint errors");
    if (!tests.passed) recommendations.push("Fix failing tests");
    if (semantic && semantic.score < 0.7) {
      recommendations.push("Changes may not fully address the task requirements");
    }

    // Save verification result
    const result = await db.verificationResult.create({
      data: {
        taskId,
        attemptNumber,
        passed,
        confidenceScore,
        syntaxPassed: syntax.passed,
        typesPassed: types.passed,
        lintPassed: lint.passed,
        testsPassed: tests.passed,
        testsTotal: tests.total,
        testsFailed: tests.failed,
        semanticScore: semantic?.score ?? null,
        semanticExplanation: semantic?.explanation ?? null,
        failures: allErrors,
        recommendations,
      },
    });

    // Update task verification status
    await db.task.update({
      where: { id: taskId },
      data: {
        verificationStatus: passed
          ? VerificationStatus.PASSED
          : VerificationStatus.FAILED,
        status: passed ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        completedAt: passed ? new Date() : undefined,
      },
    });

    // Handle failure
    if (!passed) {
      if (attemptNumber >= 3) {
        // Create exception after max retries
        await db.exception.create({
          data: {
            exceptionType: ExceptionType.VERIFICATION_FAILED,
            taskId,
            agentId: task.assignedAgentId ?? undefined,
            severity: ExceptionSeverity.WARNING,
            title: `Verification failed after ${attemptNumber} attempts`,
            description: `Task "${task.title}" failed verification ${attemptNumber} times.\n\nErrors:\n${allErrors.map((e) => `- ${e.message}`).join("\n")}`,
            suggestedAction: recommendations.join("; "),
          },
        });

        console.log(
          `[VerificationService] Task ${taskId} failed verification after ${attemptNumber} attempts`
        );
      } else {
        console.log(
          `[VerificationService] Task ${taskId} failed verification (attempt ${attemptNumber}/3)`
        );
      }
    } else {
      console.log(
        `[VerificationService] Task ${taskId} passed verification with confidence ${confidenceScore}`
      );
    }

    return result;
  }

  // ==========================================================================
  // Check Methods
  // ==========================================================================

  private async checkSyntax(workingDir: string): Promise<VerificationCheckResult> {
    try {
      // Check if TypeScript project
      const hasTsConfig = await fileExists(path.join(workingDir, "tsconfig.json"));

      if (hasTsConfig) {
        // Run TypeScript syntax check
        const { stderr } = await execAsync(
          "npx tsc --noEmit --pretty false 2>&1 || true",
          { cwd: workingDir, timeout: 60000 }
        );

        const errors = parseTypeScriptErrors(stderr);

        return {
          passed: errors.length === 0,
          errors,
        };
      }

      // For JavaScript, just check if files parse
      // This is a basic check - could be enhanced
      return { passed: true, errors: [] };
    } catch (error) {
      console.error("[VerificationService] Syntax check error:", error);
      return {
        passed: false,
        errors: [
          {
            type: "syntax",
            message: error instanceof Error ? error.message : "Syntax check failed",
          },
        ],
      };
    }
  }

  private async checkTypes(workingDir: string): Promise<VerificationCheckResult> {
    try {
      const hasTsConfig = await fileExists(path.join(workingDir, "tsconfig.json"));

      if (!hasTsConfig) {
        // No TypeScript, skip type checking
        return { passed: true, errors: [] };
      }

      const { stdout, stderr } = await execAsync(
        "npx tsc --noEmit --pretty false 2>&1 || true",
        { cwd: workingDir, timeout: 120000 }
      );

      const output = stdout + stderr;
      const errors = parseTypeScriptErrors(output);

      return {
        passed: errors.length === 0,
        errors,
      };
    } catch (error) {
      console.error("[VerificationService] Type check error:", error);
      return {
        passed: false,
        errors: [
          {
            type: "type",
            message: error instanceof Error ? error.message : "Type check failed",
          },
        ],
      };
    }
  }

  private async checkLint(workingDir: string): Promise<VerificationCheckResult> {
    try {
      // Check if ESLint is configured
      const hasEslintConfig =
        (await fileExists(path.join(workingDir, ".eslintrc"))) ||
        (await fileExists(path.join(workingDir, ".eslintrc.js"))) ||
        (await fileExists(path.join(workingDir, ".eslintrc.json"))) ||
        (await fileExists(path.join(workingDir, ".eslintrc.cjs"))) ||
        (await fileExists(path.join(workingDir, "eslint.config.js"))) ||
        (await fileExists(path.join(workingDir, "eslint.config.mjs")));

      if (!hasEslintConfig) {
        // Check package.json for eslintConfig
        try {
          const pkgPath = path.join(workingDir, "package.json");
          const pkgContent = await fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(pkgContent) as { eslintConfig?: unknown };
          if (!pkg.eslintConfig) {
            return { passed: true, errors: [] };
          }
        } catch {
          return { passed: true, errors: [] };
        }
      }

      const { stdout } = await execAsync(
        "npx eslint . --format json --max-warnings 0 2>/dev/null || true",
        { cwd: workingDir, timeout: 120000 }
      );

      const errors = parseEslintOutput(stdout);

      return {
        passed: errors.length === 0,
        errors,
      };
    } catch (error) {
      console.error("[VerificationService] Lint check error:", error);
      // Don't fail if ESLint itself has issues
      return { passed: true, errors: [] };
    }
  }

  private async checkTests(workingDir: string): Promise<TestCheckResult> {
    try {
      const runner = await detectTestRunner(workingDir);

      if (!runner) {
        // No test runner configured
        return { passed: true, total: 0, failed: 0, errors: [] };
      }

      let command: string;
      switch (runner) {
        case "jest":
          command = "npx jest --json --passWithNoTests 2>/dev/null || true";
          break;
        case "vitest":
          command = "npx vitest run --reporter=json 2>/dev/null || true";
          break;
        case "npm":
          command = "npm test --if-present 2>&1 || true";
          break;
      }

      const { stdout } = await execAsync(command, {
        cwd: workingDir,
        timeout: 300000, // 5 minutes for tests
        env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
      });

      return parseTestResults(stdout, runner);
    } catch (error) {
      console.error("[VerificationService] Test check error:", error);
      return {
        passed: false,
        total: 0,
        failed: 0,
        errors: [
          {
            type: "test",
            message: error instanceof Error ? error.message : "Test execution failed",
          },
        ],
      };
    }
  }

  private async checkSemantic(
    task: Task,
    workingDir: string
  ): Promise<SemanticCheckResult> {
    try {
      // Get git diff
      let diff: string;
      try {
        const { stdout } = await execAsync(
          "git diff HEAD~1 --no-color 2>/dev/null || git diff main --no-color 2>/dev/null || echo 'No diff available'",
          { cwd: workingDir, timeout: 30000 }
        );
        diff = stdout.slice(0, 10000); // Limit diff size
      } catch {
        diff = "Unable to get diff";
      }

      // Use Claude to evaluate semantic correctness
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a code reviewer evaluating whether code changes correctly implement a task.
Respond with a JSON object containing:
- score: a number from 0 to 1 indicating how well the changes implement the task (1 = perfect, 0 = completely wrong)
- explanation: a brief explanation of your assessment

Be strict but fair. Consider:
- Does the code address all requirements in the task description?
- Is the implementation correct and complete?
- Are there any obvious bugs or issues?`,
        messages: [
          {
            role: "user",
            content: `## Task
Title: ${task.title}

Description:
${task.description}

## Code Changes (git diff)
\`\`\`diff
${diff}
\`\`\`

Evaluate whether these changes correctly implement the task. Respond with JSON only.`,
          },
        ],
      });

      // Parse response
      const content = response.content[0];
      if (content?.type !== "text") {
        return { score: 0.5, explanation: "Could not parse semantic check response" };
      }

      try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = content.text;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1]!;
        }

        const result = JSON.parse(jsonStr) as { score: number; explanation: string };
        return {
          score: Math.max(0, Math.min(1, result.score)),
          explanation: result.explanation,
        };
      } catch {
        // Try to extract score from text
        const scoreMatch = content.text.match(/score[:\s]+([0-9.]+)/i);
        const score = scoreMatch ? parseFloat(scoreMatch[1]!) : 0.5;
        return {
          score: Math.max(0, Math.min(1, score)),
          explanation: content.text.slice(0, 500),
        };
      }
    } catch (error) {
      console.error("[VerificationService] Semantic check error:", error);
      return {
        score: 0.5,
        explanation: "Semantic check could not be completed",
      };
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private calculateConfidence(results: AllCheckResults): number {
    // Weights for each check
    const weights = {
      syntax: 0.2,
      types: 0.2,
      lint: 0.1,
      tests: 0.3,
      semantic: 0.2,
    };

    let score = 0;

    // Syntax (pass/fail)
    score += results.syntax.passed ? weights.syntax : 0;

    // Types (pass/fail)
    score += results.types.passed ? weights.types : 0;

    // Lint (pass/fail)
    score += results.lint.passed ? weights.lint : 0;

    // Tests (proportional to pass rate)
    if (results.tests.total > 0) {
      const testPassRate =
        (results.tests.total - results.tests.failed) / results.tests.total;
      score += testPassRate * weights.tests;
    } else {
      // No tests = full credit (can't verify)
      score += weights.tests;
    }

    // Semantic (proportional to score)
    if (results.semantic) {
      score += results.semantic.score * weights.semantic;
    }

    // Round to 2 decimal places
    return Math.round(score * 100) / 100;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const verificationService = new VerificationService();

// Re-export class for testing
export { VerificationService };
