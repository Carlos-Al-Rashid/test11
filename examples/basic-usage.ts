import { AgentPipeline, Agent, IssueData } from '../src';

/**
 * Example usage of the state machine and agent pipeline
 */
async function main() {
  // Create a new pipeline
  const pipeline = new AgentPipeline();

  // Register event listeners
  pipeline.on('issue-state-changed', (transition) => {
    console.log(`State changed: ${transition.from} -> ${transition.to}`);
  });

  pipeline.on('issue-priority-assigned', ({ priority }) => {
    console.log(`Priority assigned: ${priority}`);
  });

  pipeline.on('issue-labels-updated', ({ labels }) => {
    console.log(`Labels updated: ${labels.join(', ')}`);
  });

  pipeline.on('issue-ready', (issue) => {
    console.log(`Issue ready for processing: ${issue.id}`);
  });

  // Define custom agents
  const validationAgent: Agent = {
    name: 'ValidationAgent',
    process: async (issue: IssueData) => {
      console.log(`[${issue.id}] Validating issue...`);
      // Add validation logic here
      return {
        ...issue,
        labels: [...issue.labels, 'validated']
      };
    }
  };

  const analysisAgent: Agent = {
    name: 'AnalysisAgent',
    process: async (issue: IssueData) => {
      console.log(`[${issue.id}] Analyzing issue...`);
      // Add analysis logic here
      return {
        ...issue,
        labels: [...issue.labels, 'analyzed']
      };
    }
  };

  // Register agents
  pipeline.registerAgent(validationAgent);
  pipeline.registerAgent(analysisAgent);

  // Create a test issue
  const testIssue: IssueData = {
    id: 'issue-001',
    title: 'Critical bug in state machine',
    body: 'The state machine is not transitioning correctly when processing new issues.',
    state: 'new',
    labels: []
  };

  console.log('\n=== Processing Issue ===\n');

  // Process the issue
  const result = await pipeline.processIssue(testIssue);

  console.log('\n=== Processing Complete ===\n');
  console.log('Final issue state:', JSON.stringify(result, null, 2));
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
