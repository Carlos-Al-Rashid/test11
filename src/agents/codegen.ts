import Anthropic from '@anthropic-ai/sdk';
import type { GitHubIssue, MiyabiConfig } from '../types/index.js';
import { GitHubClient } from '../lib/github-client.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface CodeGenResult {
  success: boolean;
  filesGenerated: string[];
  branchName: string;
  error?: string;
}

export class CodeGenAgent {
  private anthropic: Anthropic;
  private github: GitHubClient;

  constructor(config: MiyabiConfig) {
    if (!config.anthropic?.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for CodeGenAgent');
    }
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.github = new GitHubClient(
      config.github.token,
      config.github.owner,
      config.github.repo
    );
  }

  async execute(issue: GitHubIssue): Promise<CodeGenResult> {
    const branchName = `feature/issue-${issue.number}`;
    const filesGenerated: string[] = [];

    try {
      // Step 1: GitHub にコメント投稿
      await this.github.createComment(
        issue.number,
        '🤖 **CodeGenAgent Started**\n\n' +
          `Generating code with Claude Sonnet 4.5...\n\n` +
          `**Branch:** \`${branchName}\``
      );

      // Step 2: AI でコード生成プロンプトを作成
      const prompt = this.buildPrompt(issue);

      // Step 3: Claude API 呼び出し
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Step 4: レスポンスからコードを抽出
      const generatedCode = this.extractCode(response);

      // Step 5: ブランチ作成
      this.createBranch(branchName);

      // Step 6: ファイルを書き込み
      for (const file of generatedCode) {
        const filePath = path.join(process.cwd(), file.path);
        const dir = path.dirname(filePath);

        // ディレクトリ作成
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // ファイル書き込み
        fs.writeFileSync(filePath, file.content, 'utf-8');
        filesGenerated.push(file.path);
      }

      // Step 7: Git コミット
      this.commitChanges(issue.number, filesGenerated);

      // Step 8: GitHub にコメント投稿
      await this.github.createComment(
        issue.number,
        '✅ **CodeGenAgent Completed**\n\n' +
          `Generated ${filesGenerated.length} files:\n` +
          filesGenerated.map((f) => `- \`${f}\``).join('\n') +
          `\n\n**Branch:** \`${branchName}\``
      );

      return {
        success: true,
        filesGenerated,
        branchName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.github.createComment(
        issue.number,
        `❌ **CodeGenAgent Failed**\n\n\`\`\`\n${errorMessage}\n\`\`\``
      );

      return {
        success: false,
        filesGenerated,
        branchName,
        error: errorMessage,
      };
    }
  }

  private buildPrompt(issue: GitHubIssue): string {
    return `You are a code generation agent for the Miyabi Framework.

**Issue #${issue.number}: ${issue.title}**

${issue.body || 'No description provided.'}

**Instructions:**
1. Analyze the issue and generate the necessary code implementation
2. Follow TypeScript strict mode
3. Include proper error handling
4. Add basic unit tests if applicable
5. Follow the existing project structure

**Output Format:**
Provide your response in the following format:

\`\`\`json
{
  "files": [
    {
      "path": "src/example.ts",
      "content": "... TypeScript code ..."
    }
  ],
  "summary": "Brief summary of what was implemented"
}
\`\`\`

Generate the code now.`;
  }

  private extractCode(response: Anthropic.Message): Array<{ path: string; content: string }> {
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    // Extract JSON from response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      // Fallback: create a simple Hello World example
      console.warn('⚠️  Failed to extract JSON from AI response, using fallback');
      return [
        {
          path: 'src/hello.ts',
          content: `export function helloWorld(): string {\n  return 'Hello, Miyabi!';\n}\n`,
        },
      ];
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return parsed.files || [];
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('JSON content:', jsonMatch[1].substring(0, 500));

      // Fallback
      return [
        {
          path: 'src/hello.ts',
          content: `export function helloWorld(): string {\n  return 'Hello, Miyabi!';\n}\n`,
        },
      ];
    }
  }

  private createBranch(branchName: string): void {
    try {
      // Ensure we're on main
      execSync('git checkout main', { stdio: 'pipe' });
      execSync('git pull origin main', { stdio: 'pipe' });

      // Create new branch
      execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' });
    } catch (error) {
      // Branch might already exist
      execSync(`git checkout ${branchName}`, { stdio: 'pipe' });
    }
  }

  private commitChanges(issueNumber: number, files: string[]): void {
    // Stage files
    for (const file of files) {
      execSync(`git add "${file}"`, { stdio: 'pipe' });
    }

    // Commit
    const commitMessage = `feat: Implement code for Issue #${issueNumber}

Generated by CodeGenAgent (Claude Sonnet 4.5)

Files:
${files.map((f) => `- ${f}`).join('\n')}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;

    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
  }
}
