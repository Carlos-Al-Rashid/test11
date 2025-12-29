#!/usr/bin/env tsx

import { getConfig } from '../src/lib/config.js';
import { GitHubClient } from '../src/lib/github-client.js';

async function routeIssueEvent(
  eventType: string,
  issueNumber: string
): Promise<void> {
  const config = getConfig();
  const client = new GitHubClient(
    config.github.token,
    config.github.owner,
    config.github.repo
  );

  const issueNum = parseInt(issueNumber, 10);
  console.log(`📥 Routing Issue Event: ${eventType} for #${issueNum}`);

  const issue = await client.getIssue(issueNum);

  switch (eventType) {
    case 'opened':
      console.log(`✅ Issue #${issueNum} opened: ${issue.title}`);
      // State machine will handle initial triage
      break;

    case 'labeled':
      console.log(`🏷️ Issue #${issueNum} labeled`);
      // State machine will handle label-based transitions
      break;

    case 'closed':
      console.log(`🔒 Issue #${issueNum} closed`);
      await client.transitionState(issueNum, 'done', 'Issue closed');
      break;

    case 'reopened':
      console.log(`🔓 Issue #${issueNum} reopened`);
      await client.transitionState(issueNum, 'pending', 'Issue reopened');
      break;

    default:
      console.log(`ℹ️ Unhandled issue event: ${eventType}`);
  }
}

async function routePREvent(
  eventType: string,
  prNumber: string
): Promise<void> {
  console.log(`📥 Routing PR Event: ${eventType} for #${prNumber}`);

  switch (eventType) {
    case 'opened':
      console.log(`✅ PR #${prNumber} opened`);
      break;

    case 'closed':
      console.log(`🔒 PR #${prNumber} closed`);
      break;

    case 'ready_for_review':
      console.log(`👀 PR #${prNumber} ready for review`);
      break;

    default:
      console.log(`ℹ️ Unhandled PR event: ${eventType}`);
  }
}

async function routePushEvent(
  branchName: string,
  commitSha: string
): Promise<void> {
  console.log(`📥 Routing Push Event: ${branchName} @ ${commitSha}`);

  if (branchName === 'main') {
    console.log('🚀 Push to main branch detected');
  } else {
    console.log(`📝 Push to ${branchName} branch`);
  }
}

async function routeCommentEvent(
  issueNumber: string,
  author: string
): Promise<void> {
  console.log(`📥 Routing Comment Event: #${issueNumber} by ${author}`);
  console.log('💬 Comment processed');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: webhook-router.ts <event-type> <...args>');
    console.error('');
    console.error('Examples:');
    console.error('  webhook-router.ts issue opened 123');
    console.error('  webhook-router.ts pr closed 456');
    console.error('  webhook-router.ts push main abc123');
    console.error('  webhook-router.ts comment 123 username');
    process.exit(1);
  }

  const [eventType, ...eventArgs] = args;

  try {
    switch (eventType) {
      case 'issue':
        await routeIssueEvent(eventArgs[0] ?? '', eventArgs[1] ?? '');
        break;

      case 'pr':
        await routePREvent(eventArgs[0] ?? '', eventArgs[1] ?? '');
        break;

      case 'push':
        await routePushEvent(eventArgs[0] ?? '', eventArgs[1] ?? '');
        break;

      case 'comment':
        await routeCommentEvent(eventArgs[0] ?? '', eventArgs[1] ?? '');
        break;

      default:
        console.error(`❌ Unknown event type: ${eventType}`);
        process.exit(1);
    }

    console.log('✅ Event routing completed');
  } catch (error) {
    console.error('❌ Error routing event:', error);
    process.exit(1);
  }
}

main();
