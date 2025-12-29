// Miyabi Framework Type Definitions

export type StateType =
  | 'pending'
  | 'analyzing'
  | 'implementing'
  | 'reviewing'
  | 'testing'
  | 'deploying'
  | 'done'
  | 'blocked';

export type PriorityType =
  | 'P0-Critical'
  | 'P1-High'
  | 'P2-Medium'
  | 'P3-Low';

export type AgentType =
  | 'coordinator'
  | 'issue'
  | 'codegen'
  | 'review'
  | 'pr'
  | 'deployment'
  | 'test';

export type ComplexityType =
  | 'small'
  | 'medium'
  | 'large'
  | 'xlarge';

export type IssueType =
  | 'bug'
  | 'feature'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'chore'
  | 'security';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{
    name: string;
    color: string;
    description?: string;
  }>;
  assignees: Array<{
    login: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
}

export interface StateTransitionContext {
  issue: number;
  from?: StateType;
  to: StateType;
  reason: string;
  actor?: string;
}

export interface WebhookEventContext {
  eventType: 'issue' | 'pr' | 'push' | 'comment';
  action: string;
  payload: unknown;
  repository: {
    owner: string;
    repo: string;
  };
}

export interface AgentExecutionContext {
  issueNumber: number;
  agentType: AgentType;
  config: {
    anthropicApiKey?: string;
    githubToken: string;
    repository: {
      owner: string;
      repo: string;
    };
  };
}

export interface LabelDefinition {
  name: string;
  color: string;
  description: string;
  category: string;
}

// Label prefixes for categorization
export const LABEL_PREFIXES = {
  TYPE: 'type:',
  PRIORITY: 'priority:',
  STATE: 'state:',
  AGENT: 'agent:',
  COMPLEXITY: 'complexity:',
  PHASE: 'phase:',
  IMPACT: 'impact:',
  CATEGORY: 'category:',
  EFFORT: 'effort:',
  BLOCKED: 'blocked:',
} as const;

export interface MiyabiConfig {
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  anthropic?: {
    apiKey: string;
  };
  agents: {
    enabled: AgentType[];
  };
}
