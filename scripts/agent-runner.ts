#!/usr/bin/env tsx

import { getConfig } from '../src/lib/config.js';
import { GitHubClient } from '../src/lib/github-client.js';
import type { AgentType } from '../src/types/index.js';

interface RunnerArgs {
  issue?: number;
  agent?: AgentType;
}

function parseArgs(): RunnerArgs {
  const args = process.argv.slice(2);

  let issue: number | undefined;
  let agent: AgentType | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    if (arg.startsWith('--issue=')) {
      issue = parseInt(arg.split('=')[1] ?? '', 10);
    } else if (arg.startsWith('--agent=')) {
      agent = arg.split('=')[1] as AgentType;
    }
  }

  return { issue, agent };
}

async function runAgent(
  client: GitHubClient,
  issueNumber: number,
  agentType: AgentType
): Promise<void> {
  console.log(`🤖 Running ${agentType} agent for Issue #${issueNumber}`);

  switch (agentType) {
    case 'coordinator':
      console.log('📊 CoordinatorAgent: Analyzing task and creating DAG');
      await client.createComment(
        issueNumber,
        '🤖 **CoordinatorAgent Started**\n\n' +
          'Analyzing task complexity and creating execution plan...\n\n' +
          '**Next Steps:**\n' +
          '1. Break down task into subtasks\n' +
          '2. Identify dependencies (DAG)\n' +
          '3. Assign to specialist agents\n\n' +
          '_This is a basic implementation. Full agent logic will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:coordinator']);
      break;

    case 'issue':
      console.log('🏷️ IssueAgent: Analyzing and labeling issue');
      await client.createComment(
        issueNumber,
        '🤖 **IssueAgent Started**\n\n' +
          'Analyzing issue and applying Shikigaku Theory labels...\n\n' +
          '_This is a basic implementation. Full agent logic will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:issue']);
      break;

    case 'codegen':
      console.log('⚙️ CodeGenAgent: Generating code');
      await client.createComment(
        issueNumber,
        '🤖 **CodeGenAgent Started**\n\n' +
          'Generating code implementation...\n\n' +
          '_This is a basic implementation. Full AI code generation will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:codegen']);
      break;

    case 'review':
      console.log('👀 ReviewAgent: Reviewing code quality');
      await client.createComment(
        issueNumber,
        '🤖 **ReviewAgent Started**\n\n' +
          'Running static analysis and security scan...\n\n' +
          '_This is a basic implementation. Full review logic will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:review']);
      break;

    case 'pr':
      console.log('📝 PRAgent: Creating pull request');
      await client.createComment(
        issueNumber,
        '🤖 **PRAgent Started**\n\n' +
          'Creating Draft PR with Conventional Commits...\n\n' +
          '_This is a basic implementation. Full PR creation will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:pr']);
      break;

    case 'deployment':
      console.log('🚀 DeploymentAgent: Deploying changes');
      await client.createComment(
        issueNumber,
        '🤖 **DeploymentAgent Started**\n\n' +
          'Deploying to production...\n\n' +
          '_This is a basic implementation. Full deployment logic will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:deployment']);
      break;

    case 'test':
      console.log('🧪 TestAgent: Running tests');
      await client.createComment(
        issueNumber,
        '🤖 **TestAgent Started**\n\n' +
          'Running tests and checking coverage...\n\n' +
          '_This is a basic implementation. Full test execution will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:test']);
      break;

    default:
      console.error(`❌ Unknown agent type: ${agentType}`);
      process.exit(1);
  }

  console.log(`✅ ${agentType} agent completed for Issue #${issueNumber}`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const config = getConfig();

    if (!args.issue) {
      console.error('❌ Missing required argument: --issue');
      console.error('');
      console.error('Usage: agent-runner.ts --issue=<number> [--agent=<type>]');
      console.error('');
      console.error('Agents: coordinator, issue, codegen, review, pr, deployment, test');
      console.error('');
      console.error('Example:');
      console.error('  agent-runner.ts --issue=123 --agent=coordinator');
      process.exit(1);
    }

    const client = new GitHubClient(
      config.github.token,
      config.github.owner,
      config.github.repo
    );

    const issue = await client.getIssue(args.issue);
    console.log(`📋 Issue #${args.issue}: ${issue.title}`);

    if (args.agent) {
      await runAgent(client, args.issue, args.agent);
    } else {
      // Auto-detect agent based on labels
      const labels = issue.labels.map((l) => l.name);
      const agentLabel = labels.find((l) => l.includes('agent:'));

      if (agentLabel) {
        const agentType = agentLabel.split(':')[1] as AgentType;
        await runAgent(client, args.issue, agentType);
      } else {
        console.log('🤖 No agent specified, running IssueAgent for initial triage');
        await runAgent(client, args.issue, 'issue');
      }
    }
  } catch (error) {
    console.error('❌ Error running agent:', error);
    process.exit(1);
  }
}

main();
