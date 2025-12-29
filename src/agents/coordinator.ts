import type { GitHubIssue, MiyabiConfig, ComplexityType } from '../types/index.js';
import { GitHubClient } from '../lib/github-client.js';
import Anthropic from '@anthropic-ai/sdk';

export interface Task {
  id: string;
  title: string;
  dependencies: string[];
  estimatedEffort: string;
  agent: string;
}

export interface DAG {
  tasks: Task[];
  levels: string[][];
  hasCycles: boolean;
}

export interface CoordinatorResult {
  success: boolean;
  complexity: ComplexityType;
  dag: DAG;
  executionPlan: string[];
}

export class CoordinatorAgent {
  private github: GitHubClient;
  private anthropic: Anthropic;

  constructor(config: MiyabiConfig) {
    if (!config.anthropic?.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for CoordinatorAgent');
    }
    this.github = new GitHubClient(
      config.github.token,
      config.github.owner,
      config.github.repo
    );
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async execute(issue: GitHubIssue): Promise<CoordinatorResult> {
    try {
      await this.github.createComment(
        issue.number,
        '🤖 **CoordinatorAgent Started**\n\n' +
          'Analyzing task complexity and creating execution plan...'
      );

      // Step 1: Analyze complexity with AI
      const complexity = await this.analyzeComplexity(issue);

      // Step 2: Decompose into tasks with AI
      const tasks = await this.decomposeTasks(issue);

      // Step 3: Build DAG
      const dag = this.buildDAG(tasks);

      // Step 4: Check for cycles
      if (dag.hasCycles) {
        throw new Error('Circular dependency detected in task graph');
      }

      // Step 5: Create execution plan
      const executionPlan = this.createExecutionPlan(dag);

      // Step 6: Post results
      await this.postResults(issue.number, complexity, dag, executionPlan);

      // Step 7: Add labels
      await this.github.addLabels(issue.number, [
        `📏 complexity:${complexity}`,
        '🤖 agent:coordinator',
      ]);

      return {
        success: true,
        complexity,
        dag,
        executionPlan,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.github.createComment(
        issue.number,
        `❌ **CoordinatorAgent Failed**\n\n\`\`\`\n${errorMessage}\n\`\`\``
      );

      throw error;
    }
  }

  private async analyzeComplexity(issue: GitHubIssue): Promise<ComplexityType> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analyze the complexity of this GitHub issue and respond with ONLY one word: small, medium, large, or xlarge.

Issue: ${issue.title}
${issue.body || ''}

Complexity:`,
        },
      ],
    });

    const complexity = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('')
      .trim()
      .toLowerCase() as ComplexityType;

    return ['small', 'medium', 'large', 'xlarge'].includes(complexity)
      ? complexity
      : 'medium';
  }

  private async decomposeTasks(issue: GitHubIssue): Promise<Task[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Break down this GitHub issue into concrete implementation tasks.

Issue: ${issue.title}
${issue.body || ''}

Provide your response in JSON format:
\`\`\`json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Task description",
      "dependencies": [],
      "estimatedEffort": "1h",
      "agent": "codegen"
    }
  ]
}
\`\`\`

Available agents: codegen, review, test, pr
Keep it simple - 3-5 tasks maximum.`,
        },
      ],
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      // Fallback: simple task decomposition
      return [
        { id: 'task-1', title: 'Generate code', dependencies: [], estimatedEffort: '1h', agent: 'codegen' },
        { id: 'task-2', title: 'Review code', dependencies: ['task-1'], estimatedEffort: '30m', agent: 'review' },
        { id: 'task-3', title: 'Create PR', dependencies: ['task-2'], estimatedEffort: '15m', agent: 'pr' },
      ];
    }

    const parsed = JSON.parse(jsonMatch[1]);
    return parsed.tasks;
  }

  private buildDAG(tasks: Task[]): DAG {
    const levels: string[][] = [];
    const visited = new Set<string>();
    const inProgress = new Set<string>();
    let hasCycles = false;

    // Topological sort using DFS
    const visit = (taskId: string, level: number): void => {
      if (inProgress.has(taskId)) {
        hasCycles = true;
        return;
      }
      if (visited.has(taskId)) return;

      inProgress.add(taskId);

      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        for (const dep of task.dependencies) {
          visit(dep, level + 1);
        }
      }

      visited.add(taskId);
      inProgress.delete(taskId);

      // Add to level
      while (levels.length <= level) {
        levels.push([]);
      }
      const currentLevel = levels[level];
      if (currentLevel) {
        currentLevel.push(taskId);
      }
    };

    // Visit all tasks
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        visit(task.id, 0);
      }
    }

    return { tasks, levels: levels.reverse(), hasCycles };
  }

  private createExecutionPlan(dag: DAG): string[] {
    const plan: string[] = [];

    for (let i = 0; i < dag.levels.length; i++) {
      const level = dag.levels[i];
      if (!level) continue;

      if (level.length === 1) {
        plan.push(`Level ${i + 1}: ${level[0] ?? ''}`);
      } else {
        plan.push(`Level ${i + 1}: ${level.join(', ')} (parallel)`);
      }
    }

    return plan;
  }

  private async postResults(
    issueNumber: number,
    complexity: ComplexityType,
    dag: DAG,
    executionPlan: string[]
  ): Promise<void> {
    let comment = '✅ **CoordinatorAgent Completed**\n\n';
    comment += `**Complexity:** ${complexity.toUpperCase()}\n`;
    comment += `**Tasks Identified:** ${dag.tasks.length}\n`;
    comment += `**Execution Levels:** ${dag.levels.length}\n\n`;

    comment += '### Task Breakdown\n\n';
    for (const task of dag.tasks) {
      comment += `- **${task.id}**: ${task.title}\n`;
      comment += `  - Agent: \`${task.agent}\`\n`;
      comment += `  - Effort: ${task.estimatedEffort}\n`;
      if (task.dependencies.length > 0) {
        comment += `  - Dependencies: ${task.dependencies.join(', ')}\n`;
      }
    }

    comment += '\n### Execution Plan (DAG)\n\n';
    for (const step of executionPlan) {
      comment += `${step}\n`;
    }

    await this.github.createComment(issueNumber, comment);
  }
}
