import { Octokit } from '@octokit/rest';
import type { GitHubIssue, StateType, LabelDefinition } from '../types/index.js';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    const { data } = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    });

    return {
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.state as 'open' | 'closed',
      labels: data.labels.map((label) => {
        if (typeof label === 'string') {
          return { name: label, color: '' };
        }
        return {
          name: label.name ?? '',
          color: label.color ?? '',
          description: label.description ?? undefined,
        };
      }),
      assignees: data.assignees?.map((assignee) => ({
        login: assignee?.login ?? '',
      })) ?? [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels,
    });
  }

  async removeLabel(issueNumber: number, labelName: string): Promise<void> {
    try {
      await this.octokit.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: labelName,
      });
    } catch (error) {
      // Label might not exist, ignore error
      console.warn(`Could not remove label ${labelName}:`, error);
    }
  }

  async createComment(issueNumber: number, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });
  }

  async updateIssueState(issueNumber: number, state: 'open' | 'closed'): Promise<void> {
    await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      state,
    });
  }

  async transitionState(
    issueNumber: number,
    toState: StateType,
    reason: string
  ): Promise<void> {
    // Get current issue
    const issue = await this.getIssue(issueNumber);

    // Find and remove current state labels
    const stateLabels = issue.labels
      .map((l) => l.name)
      .filter((name) => name.includes('state:'));

    for (const label of stateLabels) {
      await this.removeLabel(issueNumber, label);
    }

    // Add new state label
    const stateEmojis: Record<StateType, string> = {
      pending: '⏸️',
      analyzing: '🔍',
      implementing: '⚙️',
      reviewing: '👀',
      testing: '🧪',
      deploying: '🚀',
      done: '✅',
      blocked: '🔴',
    };

    const emoji = stateEmojis[toState] ?? '📍';
    const newLabel = `${emoji} state:${toState}`;

    await this.addLabels(issueNumber, [newLabel]);

    // Add comment about state transition
    await this.createComment(
      issueNumber,
      `## 🔄 State Transition: **${toState}**\n\n**Reason:** ${reason}\n\n---\n*Automated by Miyabi State Machine*`
    );
  }

  async createOrUpdateLabel(label: LabelDefinition): Promise<void> {
    try {
      await this.octokit.issues.updateLabel({
        owner: this.owner,
        repo: this.repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    } catch {
      // Label doesn't exist, create it
      await this.octokit.issues.createLabel({
        owner: this.owner,
        repo: this.repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    }
  }

  async listIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    const { data } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state,
      per_page: 100,
    });

    return data.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state as 'open' | 'closed',
      labels: issue.labels.map((label) => {
        if (typeof label === 'string') {
          return { name: label, color: '' };
        }
        return {
          name: label.name ?? '',
          color: label.color ?? '',
          description: label.description ?? undefined,
        };
      }),
      assignees: issue.assignees?.map((assignee) => ({
        login: assignee?.login ?? '',
      })) ?? [],
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }));
  }
}
