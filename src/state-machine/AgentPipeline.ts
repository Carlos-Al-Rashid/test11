import { EventEmitter } from 'events';
import { IssueData, IssueFSM } from './IssueFSM';

export interface Agent {
  name: string;
  process(issue: IssueData): Promise<IssueData>;
}

export class AgentPipeline extends EventEmitter {
  private agents: Agent[] = [];
  private fsm: IssueFSM | null = null;

  /**
   * Register an agent to the pipeline
   */
  public registerAgent(agent: Agent): void {
    this.agents.push(agent);
    this.emit('agent-registered', { name: agent.name });
  }

  /**
   * Process an issue through the pipeline
   */
  public async processIssue(issue: IssueData): Promise<IssueData> {
    try {
      // Initialize FSM
      this.fsm = new IssueFSM(issue);
      
      // Set up FSM event listeners
      this.setupFSMListeners();

      // Initialize and auto-process
      await this.fsm.initialize();

      // Get processed issue
      let processedIssue = this.fsm.getIssue();

      // Run through agent pipeline
      for (const agent of this.agents) {
        this.emit('agent-start', { agent: agent.name, issue: processedIssue.id });
        processedIssue = await agent.process(processedIssue);
        this.emit('agent-complete', { agent: agent.name, issue: processedIssue.id });
      }

      this.emit('pipeline-complete', processedIssue);
      return processedIssue;
    } catch (error) {
      this.emit('pipeline-error', error);
      throw error;
    }
  }

  /**
   * Set up FSM event listeners
   */
  private setupFSMListeners(): void {
    if (!this.fsm) return;

    this.fsm.on('state-changed', (transition) => {
      this.emit('issue-state-changed', transition);
    });

    this.fsm.on('priority-assigned', (data) => {
      this.emit('issue-priority-assigned', data);
    });

    this.fsm.on('labels-updated', (data) => {
      this.emit('issue-labels-updated', data);
    });

    this.fsm.on('ready-for-processing', (issue) => {
      this.emit('issue-ready', issue);
    });

    this.fsm.on('error', (error) => {
      this.emit('fsm-error', error);
    });
  }

  /**
   * Get registered agents
   */
  public getAgents(): Agent[] {
    return [...this.agents];
  }

  /**
   * Clear all agents
   */
  public clearAgents(): void {
    this.agents = [];
    this.emit('agents-cleared');
  }
}
