import { AgentPipeline, Agent } from '../../src/state-machine/AgentPipeline';
import { IssueData } from '../../src/state-machine/IssueFSM';

describe('AgentPipeline', () => {
  let pipeline: AgentPipeline;
  let testIssue: IssueData;

  beforeEach(() => {
    pipeline = new AgentPipeline();
    testIssue = {
      id: 'test-456',
      title: 'Test Pipeline Issue',
      body: 'Testing agent pipeline',
      state: 'new',
      labels: []
    };
  });

  describe('agent registration', () => {
    it('should register agents', () => {
      const agent: Agent = {
        name: 'TestAgent',
        process: async (issue) => issue
      };

      pipeline.registerAgent(agent);
      expect(pipeline.getAgents()).toHaveLength(1);
    });

    it('should emit agent-registered event', () => {
      const agent: Agent = {
        name: 'TestAgent',
        process: async (issue) => issue
      };
      const spy = jest.fn();
      pipeline.on('agent-registered', spy);

      pipeline.registerAgent(agent);
      expect(spy).toHaveBeenCalledWith({ name: 'TestAgent' });
    });
  });

  describe('issue processing', () => {
    it('should process issue through FSM initialization', async () => {
      const result = await pipeline.processIssue(testIssue);
      
      expect(result.state).toBe('pending');
      expect(result.priority).toBeDefined();
      expect(result.labels.length).toBeGreaterThan(0);
    });

    it('should process issue through all agents', async () => {
      const agent1: Agent = {
        name: 'Agent1',
        process: async (issue) => ({
          ...issue,
          labels: [...issue.labels, 'agent1-processed']
        })
      };

      const agent2: Agent = {
        name: 'Agent2',
        process: async (issue) => ({
          ...issue,
          labels: [...issue.labels, 'agent2-processed']
        })
      };

      pipeline.registerAgent(agent1);
      pipeline.registerAgent(agent2);

      const result = await pipeline.processIssue(testIssue);
      
      expect(result.labels).toContain('agent1-processed');
      expect(result.labels).toContain('agent2-processed');
    });

    it('should emit pipeline events', async () => {
      const agent: Agent = {
        name: 'TestAgent',
        process: async (issue) => issue
      };
      pipeline.registerAgent(agent);

      const agentStartSpy = jest.fn();
      const agentCompleteSpy = jest.fn();
      const pipelineCompleteSpy = jest.fn();

      pipeline.on('agent-start', agentStartSpy);
      pipeline.on('agent-complete', agentCompleteSpy);
      pipeline.on('pipeline-complete', pipelineCompleteSpy);

      await pipeline.processIssue(testIssue);

      expect(agentStartSpy).toHaveBeenCalled();
      expect(agentCompleteSpy).toHaveBeenCalled();
      expect(pipelineCompleteSpy).toHaveBeenCalled();
    });

    it('should emit FSM events during processing', async () => {
      const stateChangedSpy = jest.fn();
      const priorityAssignedSpy = jest.fn();
      const labelsUpdatedSpy = jest.fn();
      const issueReadySpy = jest.fn();

      pipeline.on('issue-state-changed', stateChangedSpy);
      pipeline.on('issue-priority-assigned', priorityAssignedSpy);
      pipeline.on('issue-labels-updated', labelsUpdatedSpy);
      pipeline.on('issue-ready', issueReadySpy);

      await pipeline.processIssue(testIssue);

      expect(stateChangedSpy).toHaveBeenCalled();
      expect(priorityAssignedSpy).toHaveBeenCalled();
      expect(labelsUpdatedSpy).toHaveBeenCalled();
      expect(issueReadySpy).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const errorAgent: Agent = {
        name: 'ErrorAgent',
        process: async () => {
          throw new Error('Agent processing failed');
        }
      };
      pipeline.registerAgent(errorAgent);

      const errorSpy = jest.fn();
      pipeline.on('pipeline-error', errorSpy);

      await expect(pipeline.processIssue(testIssue)).rejects.toThrow(
        'Agent processing failed'
      );
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('agent management', () => {
    it('should clear all agents', () => {
      const agent: Agent = {
        name: 'TestAgent',
        process: async (issue) => issue
      };
      pipeline.registerAgent(agent);
      
      pipeline.clearAgents();
      expect(pipeline.getAgents()).toHaveLength(0);
    });

    it('should emit agents-cleared event', () => {
      const spy = jest.fn();
      pipeline.on('agents-cleared', spy);
      
      pipeline.clearAgents();
      expect(spy).toHaveBeenCalled();
    });
  });
});
