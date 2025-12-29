import type { GitHubIssue, MiyabiConfig } from '../types/index.js';
import { GitHubClient } from '../lib/github-client.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ReviewResult {
  success: boolean;
  qualityScore: number;
  passed: boolean;
  issues: QualityIssue[];
  metrics: QualityMetrics;
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  file: string;
  line?: number;
  message: string;
  category: 'typescript' | 'eslint' | 'security' | 'complexity';
}

export interface QualityMetrics {
  typeScriptErrors: number;
  eslintErrors: number;
  eslintWarnings: number;
  securityIssues: number;
  filesReviewed: number;
}

const QUALITY_THRESHOLD = 80;

export class ReviewAgent {
  private github: GitHubClient;

  constructor(config: MiyabiConfig) {
    this.github = new GitHubClient(
      config.github.token,
      config.github.owner,
      config.github.repo
    );
  }

  async execute(issue: GitHubIssue, branchName: string): Promise<ReviewResult> {
    const issues: QualityIssue[] = [];
    let metrics: QualityMetrics = {
      typeScriptErrors: 0,
      eslintErrors: 0,
      eslintWarnings: 0,
      securityIssues: 0,
      filesReviewed: 0,
    };

    try {
      await this.github.createComment(
        issue.number,
        '🤖 **ReviewAgent Started**\n\n' +
          `Running static analysis and security scan...\n\n` +
          `**Target:** \`${branchName}\``
      );

      // Step 1: Checkout branch
      try {
        execSync(`git checkout ${branchName}`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Failed to checkout branch ${branchName}`);
      }

      // Step 2: TypeScript type check
      const tsIssues = this.runTypeScriptCheck();
      issues.push(...tsIssues);
      metrics.typeScriptErrors = tsIssues.filter((i) => i.severity === 'error').length;

      // Step 3: ESLint check
      const lintIssues = this.runESLintCheck();
      issues.push(...lintIssues);
      metrics.eslintErrors = lintIssues.filter((i) => i.severity === 'error').length;
      metrics.eslintWarnings = lintIssues.filter((i) => i.severity === 'warning').length;

      // Step 4: Security scan (basic)
      const securityIssues = this.runSecurityScan();
      issues.push(...securityIssues);
      metrics.securityIssues = securityIssues.length;

      // Step 5: Count files reviewed
      metrics.filesReviewed = this.countChangedFiles(branchName);

      // Step 6: Calculate quality score
      const qualityScore = this.calculateQualityScore(metrics, issues);
      const passed = qualityScore >= QUALITY_THRESHOLD;

      // Step 7: Post results
      await this.postReviewResults(issue.number, qualityScore, passed, metrics, issues);

      // Step 8: Escalate if failed
      if (!passed) {
        await this.escalate(issue.number, qualityScore, issues);
      }

      return {
        success: true,
        qualityScore,
        passed,
        issues,
        metrics,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.github.createComment(
        issue.number,
        `❌ **ReviewAgent Failed**\n\n\`\`\`\n${errorMessage}\n\`\`\``
      );

      return {
        success: false,
        qualityScore: 0,
        passed: false,
        issues,
        metrics,
      };
    }
  }

  private runTypeScriptCheck(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    try {
      execSync('npm run typecheck', { stdio: 'pipe', encoding: 'utf-8' });
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      const lines = output.split('\n');

      for (const line of lines) {
        // Parse TypeScript error format: file.ts(line,col): error TS####: message
        const match = line.match(/(.+\.ts)\((\d+),\d+\): error TS\d+: (.+)/);
        if (match && match[1] && match[2] && match[3]) {
          issues.push({
            severity: 'error',
            file: match[1],
            line: parseInt(match[2], 10),
            message: match[3],
            category: 'typescript',
          });
        }
      }
    }

    return issues;
  }

  private runESLintCheck(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    try {
      execSync('npm run lint', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // ESLint passed
      return issues;
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      const lines = output.split('\n');

      for (const line of lines) {
        // Parse ESLint format: file.ts:line:col: error/warning message
        const match = line.match(/(.+\.ts):(\d+):\d+: (error|warning) (.+)/);
        if (match && match[1] && match[2] && match[3] && match[4]) {
          issues.push({
            severity: match[3] as 'error' | 'warning',
            file: match[1],
            line: parseInt(match[2], 10),
            message: match[4],
            category: 'eslint',
          });
        }
      }
    }

    return issues;
  }

  private runSecurityScan(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Basic security scan - check for common issues
    const dangerousPatterns = [
      { pattern: /eval\(/, message: 'Use of eval() is dangerous' },
      { pattern: /process\.env\.\w+(?!\s*\?)/, message: 'Environment variable without fallback' },
      { pattern: /\.innerHTML\s*=/, message: 'Use of innerHTML can lead to XSS' },
      { pattern: /execSync\([^)]*\$\{/, message: 'Potential command injection' },
    ];

    const files = this.getChangedFiles();

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

      const fullPath = path.join(process.cwd(), file);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        for (const { pattern, message } of dangerousPatterns) {
          if (pattern.test(line)) {
            issues.push({
              severity: 'warning',
              file,
              line: i + 1,
              message,
              category: 'security',
            });
          }
        }
      }
    }

    return issues;
  }

  private calculateQualityScore(metrics: QualityMetrics, _issues: QualityIssue[]): number {
    let score = 100;

    // Deduct points for errors
    score -= metrics.typeScriptErrors * 10;
    score -= metrics.eslintErrors * 5;
    score -= metrics.eslintWarnings * 2;
    score -= metrics.securityIssues * 8;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private countChangedFiles(branchName: string): number {
    try {
      const output = execSync(`git diff --name-only origin/main...${branchName}`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return output.trim().split('\n').filter((f) => f.length > 0).length;
    } catch {
      return 0;
    }
  }

  private getChangedFiles(): string[] {
    try {
      const output = execSync('git diff --name-only origin/main', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return output.trim().split('\n').filter((f) => f.length > 0);
    } catch {
      return [];
    }
  }

  private async postReviewResults(
    issueNumber: number,
    score: number,
    passed: boolean,
    metrics: QualityMetrics,
    issues: QualityIssue[]
  ): Promise<void> {
    const status = passed ? '✅' : '❌';
    const emoji = passed ? '🎉' : '⚠️';

    let comment = `${status} **ReviewAgent Completed**\n\n`;
    comment += `${emoji} **Quality Score: ${score}/100** ${passed ? '(PASSED)' : '(FAILED)'}\n\n`;
    comment += `### Metrics\n`;
    comment += `- TypeScript Errors: ${metrics.typeScriptErrors}\n`;
    comment += `- ESLint Errors: ${metrics.eslintErrors}\n`;
    comment += `- ESLint Warnings: ${metrics.eslintWarnings}\n`;
    comment += `- Security Issues: ${metrics.securityIssues}\n`;
    comment += `- Files Reviewed: ${metrics.filesReviewed}\n\n`;

    if (issues.length > 0) {
      comment += `### Issues Found (${issues.length})\n\n`;
      const topIssues = issues.slice(0, 10);
      for (const issue of topIssues) {
        const icon = issue.severity === 'error' ? '🔴' : '🟡';
        comment += `${icon} **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
      }
      if (issues.length > 10) {
        comment += `\n_...and ${issues.length - 10} more issues_\n`;
      }
    }

    if (!passed) {
      comment += `\n⚠️ **Quality threshold not met (${QUALITY_THRESHOLD} required)**\n`;
      comment += `This issue will be escalated to TechLead for review.\n`;
    }

    await this.github.createComment(issueNumber, comment);
  }

  private async escalate(
    issueNumber: number,
    score: number,
    issues: QualityIssue[]
  ): Promise<void> {
    await this.github.createComment(
      issueNumber,
      `🚨 **ESCALATION: Quality Review Failed**\n\n` +
        `@TechLead - This issue requires attention.\n\n` +
        `**Score:** ${score}/${QUALITY_THRESHOLD}\n` +
        `**Issues:** ${issues.length}\n\n` +
        `**Severity:** Sev.2-High`
    );

    await this.github.addLabels(issueNumber, ['🚨 blocked:quality-review']);
  }
}
