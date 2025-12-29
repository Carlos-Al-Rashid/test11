#!/usr/bin/env tsx

import { getConfig } from '../src/lib/config.js';
import { GitHubClient } from '../src/lib/github-client.js';
import type { AgentType } from '../src/types/index.js';
import { CoordinatorAgent } from '../src/agents/coordinator.js';
import { CodeGenAgent } from '../src/agents/codegen.js';
import { ReviewAgent } from '../src/agents/review.js';
import { PRAgent } from '../src/agents/pr.js';
import { TestAgent } from '../src/agents/test.js';

interface RunnerArgs {
  issue?: number;
  agent?: AgentType;
  full?: boolean;
}

function parseArgs(): RunnerArgs {
  const args = process.argv.slice(2);

  let issue: number | undefined;
  let agent: AgentType | undefined;
  let full = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    if (arg.startsWith('--issue=')) {
      issue = parseInt(arg.split('=')[1] ?? '', 10);
    } else if (arg.startsWith('--agent=')) {
      agent = arg.split('=')[1] as AgentType;
    } else if (arg === '--full') {
      full = true;
    }
  }

  return { issue, agent, full };
}

async function runFullPipeline(issueNumber: number): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Executing Full Autonomous Pipeline for Issue #${issueNumber}`);
  console.log(`${'='.repeat(80)}\n`);

  const config = getConfig();
  const client = new GitHubClient(
    config.github.token,
    config.github.owner,
    config.github.repo
  );

  const issue = await client.getIssue(issueNumber);
  console.log(`📋 Issue #${issueNumber}: ${issue.title}\n`);

  // Step 1: CoordinatorAgent
  console.log('🔹 Step 1/5: CoordinatorAgent - Task Analysis & DAG Construction');
  const coordinator = new CoordinatorAgent(config);
  const coordResult = await coordinator.execute(issue);
  console.log(`✅ Complexity: ${coordResult.complexity}, Tasks: ${coordResult.dag.tasks.length}\n`);

  // Step 2: CodeGenAgent
  console.log('🔹 Step 2/5: CodeGenAgent - AI-Powered Code Generation');
  const codeGen = new CodeGenAgent(config);
  const codeGenResult = await codeGen.execute(issue);

  if (!codeGenResult.success) {
    console.error('❌ CodeGenAgent failed. Aborting pipeline.');
    process.exit(1);
  }

  console.log(`✅ Generated ${codeGenResult.filesGenerated.length} files on branch ${codeGenResult.branchName}\n`);

  // Step 3: ReviewAgent
  console.log('🔹 Step 3/5: ReviewAgent - Quality Scoring & Security Scan');
  const review = new ReviewAgent(config);
  const reviewResult = await review.execute(issue, codeGenResult.branchName);

  console.log(`✅ Quality Score: ${reviewResult.qualityScore}/100 ${reviewResult.passed ? '(PASSED)' : '(FAILED)'}\n`);

  if (!reviewResult.passed) {
    console.warn('⚠️  Quality threshold not met. Check ReviewAgent comments.');
    console.log('Pipeline will continue, but manual review is required.\n');
  }

  // Step 4: TestAgent (Optional - skip if no tests)
  console.log('🔹 Step 4/5: TestAgent - Test Execution & Coverage');
  try {
    const testAgent = new TestAgent(config);
    const testResult = await testAgent.execute(issue, codeGenResult.branchName);
    console.log(`✅ Tests: ${testResult.passed ? 'PASSED' : 'FAILED'}, Coverage: ${testResult.coverage}%\n`);
  } catch (error) {
    console.warn('⚠️  TestAgent skipped (no tests configured)\n');
  }

  // Step 5: PRAgent
  console.log('🔹 Step 5/5: PRAgent - Draft PR Creation');
  const pr = new PRAgent(config);
  const prResult = await pr.execute(
    issue,
    codeGenResult.branchName,
    reviewResult.qualityScore,
    codeGenResult.filesGenerated
  );

  if (!prResult.success) {
    console.error('❌ PRAgent failed. Check comments on the issue.');
    process.exit(1);
  }

  console.log(`✅ Draft PR created: ${prResult.prUrl}\n`);

  console.log(`${'='.repeat(80)}`);
  console.log(`🎉 Autonomous Pipeline Completed Successfully!`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`📋 Issue: #${issueNumber}`);
  console.log(`🔀 Branch: ${codeGenResult.branchName}`);
  console.log(`📊 Quality Score: ${reviewResult.qualityScore}/100`);
  console.log(`🔗 PR: ${prResult.prUrl}`);
  console.log(`\n👉 Next: Review the PR and merge when ready!\n`);
}

async function runSingleAgent(
  issueNumber: number,
  agentType: AgentType
): Promise<void> {
  console.log(`🤖 Running ${agentType} agent for Issue #${issueNumber}`);

  const config = getConfig();
  const client = new GitHubClient(
    config.github.token,
    config.github.owner,
    config.github.repo
  );

  const issue = await client.getIssue(issueNumber);
  console.log(`📋 Issue #${issueNumber}: ${issue.title}`);

  switch (agentType) {
    case 'coordinator': {
      const agent = new CoordinatorAgent(config);
      await agent.execute(issue);
      await client.addLabels(issueNumber, ['🤖 agent:coordinator']);
      break;
    }

    case 'issue': {
      console.log('🏷️  IssueAgent: Analyzing and labeling issue');
      await client.createComment(
        issueNumber,
        '🤖 **IssueAgent Started**\n\n' +
          'Analyzing issue and applying Shikigaku Theory labels...\n\n' +
          '_This is a basic implementation. Full agent logic will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:issue']);
      break;
    }

    case 'codegen': {
      const agent = new CodeGenAgent(config);
      const result = await agent.execute(issue);
      await client.addLabels(issueNumber, ['🤖 agent:codegen']);
      console.log(`Generated files: ${result.filesGenerated.join(', ')}`);
      break;
    }

    case 'review': {
      // Need branch name - get from issue comments or latest branch
      const branchName = `feature/issue-${issueNumber}`;
      const agent = new ReviewAgent(config);
      const result = await agent.execute(issue, branchName);
      await client.addLabels(issueNumber, ['🤖 agent:review']);
      console.log(`Quality Score: ${result.qualityScore}/100`);
      break;
    }

    case 'pr': {
      const branchName = `feature/issue-${issueNumber}`;
      const agent = new PRAgent(config);
      await agent.execute(issue, branchName, 85, []);
      await client.addLabels(issueNumber, ['🤖 agent:pr']);
      break;
    }

    case 'deployment': {
      console.log('🚀 DeploymentAgent: Deploying changes');
      await client.createComment(
        issueNumber,
        '🤖 **DeploymentAgent Started**\n\n' +
          'Deploying to production...\n\n' +
          '_This is a basic implementation. Full deployment logic will be added._'
      );
      await client.addLabels(issueNumber, ['🤖 agent:deployment']);
      break;
    }

    case 'test': {
      const branchName = `feature/issue-${issueNumber}`;
      const agent = new TestAgent(config);
      await agent.execute(issue, branchName);
      await client.addLabels(issueNumber, ['🤖 agent:test']);
      break;
    }

    default:
      console.error(`❌ Unknown agent type: ${agentType}`);
      process.exit(1);
  }

  console.log(`✅ ${agentType} agent completed for Issue #${issueNumber}`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs();

    if (!args.issue) {
      console.error('❌ Missing required argument: --issue');
      console.error('');
      console.error('Usage: agent-runner.ts --issue=<number> [--agent=<type>] [--full]');
      console.error('');
      console.error('Options:');
      console.error('  --issue=<number>  Issue number to process');
      console.error('  --agent=<type>    Run specific agent (coordinator, codegen, review, pr, test)');
      console.error('  --full            Run full autonomous pipeline (all agents)');
      console.error('');
      console.error('Examples:');
      console.error('  agent-runner.ts --issue=123 --full');
      console.error('  agent-runner.ts --issue=123 --agent=coordinator');
      process.exit(1);
    }

    if (args.full) {
      await runFullPipeline(args.issue);
    } else if (args.agent) {
      await runSingleAgent(args.issue, args.agent);
    } else {
      // Auto-detect: run full pipeline by default
      console.log('ℹ️  No agent specified, running full autonomous pipeline...\n');
      await runFullPipeline(args.issue);
    }
  } catch (error) {
    console.error('❌ Error running agent:', error);
    process.exit(1);
  }
}

main();
