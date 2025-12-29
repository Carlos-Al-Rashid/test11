import { EventEmitter } from 'events';

export type IssueState = 'new' | 'pending' | 'in_progress' | 'review' | 'done' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface IssueData {
  id: string;
  title: string;
  body: string;
  state: IssueState;
  priority?: IssuePriority;
  labels: string[];
  assignee?: string;
}

export interface StateTransition {
  from: IssueState;
  to: IssueState;
  timestamp: Date;
  reason?: string;
}

export class IssueFSM extends EventEmitter {
  private issue: IssueData;
  private transitionHistory: StateTransition[] = [];

  constructor(issue: IssueData) {
    super();
    this.issue = { ...issue };
  }

  /**
   * Initialize the state machine and trigger auto-processing
   */
  public async initialize(): Promise<void> {
    try {
      if (this.issue.state === 'new') {
        // Step 1: Transition to pending
        await this.transitionToPending();

        // Step 2: Auto-assign priority
        await this.autoAssignPriority();

        // Step 3: Add appropriate labels
        await this.addAutoLabels();

        // Step 4: Trigger next agent
        this.emit('ready-for-processing', this.issue);
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Transition issue to pending state
   */
  private async transitionToPending(): Promise<void> {
    const previousState = this.issue.state;
    this.issue.state = 'pending';
    
    const transition: StateTransition = {
      from: previousState,
      to: 'pending',
      timestamp: new Date(),
      reason: 'Auto-transition from new issue'
    };
    
    this.transitionHistory.push(transition);
    this.emit('state-changed', transition);
  }

  /**
   * Auto-assign priority based on title and body keywords
   */
  private async autoAssignPriority(): Promise<void> {
    const text = `${this.issue.title} ${this.issue.body}`.toLowerCase();
    
    const priorityKeywords = {
      critical: ['critical', 'urgent', 'emergency', 'production down', 'security'],
      high: ['high priority', 'important', 'blocker', 'blocking', 'asap'],
      medium: ['medium', 'should', 'need', 'improvement'],
      low: ['low', 'minor', 'nice to have', 'enhancement', 'documentation']
    };

    let assignedPriority: IssuePriority = 'medium'; // default

    // Check in order of severity
    for (const keyword of priorityKeywords.critical) {
      if (text.includes(keyword)) {
        assignedPriority = 'critical';
        break;
      }
    }

    if (assignedPriority === 'medium') {
      for (const keyword of priorityKeywords.high) {
        if (text.includes(keyword)) {
          assignedPriority = 'high';
          break;
        }
      }
    }

    if (assignedPriority === 'medium') {
      for (const keyword of priorityKeywords.low) {
        if (text.includes(keyword)) {
          assignedPriority = 'low';
          break;
        }
      }
    }

    this.issue.priority = assignedPriority;
    this.emit('priority-assigned', { priority: assignedPriority });
  }

  /**
   * Add labels based on content analysis
   */
  private async addAutoLabels(): Promise<void> {
    const text = `${this.issue.title} ${this.issue.body}`.toLowerCase();
    const newLabels: string[] = [];

    // Priority label
    if (this.issue.priority) {
      newLabels.push(`priority:${this.issue.priority}`);
    }

    // Type labels
    if (text.includes('bug') || text.includes('error') || text.includes('fix')) {
      newLabels.push('bug');
    }
    if (text.includes('feature') || text.includes('enhancement')) {
      newLabels.push('enhancement');
    }
    if (text.includes('test') || text.includes('testing')) {
      newLabels.push('testing');
    }
    if (text.includes('documentation') || text.includes('docs')) {
      newLabels.push('documentation');
    }

    // Component labels
    if (text.includes('state machine') || text.includes('fsm')) {
      newLabels.push('state-machine');
    }
    if (text.includes('agent') || text.includes('pipeline')) {
      newLabels.push('agent-system');
    }

    // Add state label
    newLabels.push(`state:${this.issue.state}`);

    // Merge with existing labels (avoid duplicates)
    this.issue.labels = [...new Set([...this.issue.labels, ...newLabels])];
    this.emit('labels-updated', { labels: this.issue.labels });
  }

  /**
   * Manual state transition with validation
   */
  public async transition(toState: IssueState, reason?: string): Promise<void> {
    const validTransitions: Record<IssueState, IssueState[]> = {
      new: ['pending', 'closed'],
      pending: ['in_progress', 'closed'],
      in_progress: ['review', 'pending', 'closed'],
      review: ['done', 'in_progress', 'closed'],
      done: ['closed', 'in_progress'],
      closed: ['pending']
    };

    if (!validTransitions[this.issue.state]?.includes(toState)) {
      throw new Error(
        `Invalid transition from ${this.issue.state} to ${toState}`
      );
    }

    const previousState = this.issue.state;
    this.issue.state = toState;

    const transition: StateTransition = {
      from: previousState,
      to: toState,
      timestamp: new Date(),
      reason
    };

    this.transitionHistory.push(transition);
    this.emit('state-changed', transition);

    // Update state label
    this.issue.labels = this.issue.labels.filter(l => !l.startsWith('state:'));
    this.issue.labels.push(`state:${toState}`);
  }

  /**
   * Get current issue state
   */
  public getIssue(): IssueData {
    return { ...this.issue };
  }

  /**
   * Get transition history
   */
  public getHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Check if issue can transition to a given state
   */
  public canTransitionTo(toState: IssueState): boolean {
    const validTransitions: Record<IssueState, IssueState[]> = {
      new: ['pending', 'closed'],
      pending: ['in_progress', 'closed'],
      in_progress: ['review', 'pending', 'closed'],
      review: ['done', 'in_progress', 'closed'],
      done: ['closed', 'in_progress'],
      closed: ['pending']
    };

    return validTransitions[this.issue.state]?.includes(toState) ?? false;
  }
}
