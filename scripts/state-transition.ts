#!/usr/bin/env tsx

import { getConfig } from '../src/lib/config.js';
import { GitHubClient } from '../src/lib/github-client.js';
import type { StateType } from '../src/types/index.js';

interface TransitionArgs {
  issue: number;
  to: StateType;
  reason: string;
}

function parseArgs(): TransitionArgs {
  const args = process.argv.slice(2);

  let issue: number | undefined;
  let to: StateType | undefined;
  let reason = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    if (arg.startsWith('--issue=')) {
      issue = parseInt(arg.split('=')[1] ?? '', 10);
    } else if (arg.startsWith('--to=')) {
      to = arg.split('=')[1] as StateType;
    } else if (arg.startsWith('--reason=')) {
      reason = arg.split('=')[1] ?? '';
    }
  }

  if (!issue || !to || !reason) {
    console.error('❌ Missing required arguments');
    console.error('');
    console.error('Usage: state-transition.ts --issue=<number> --to=<state> --reason=<reason>');
    console.error('');
    console.error('States: pending, analyzing, implementing, reviewing, testing, deploying, done, blocked');
    console.error('');
    console.error('Example:');
    console.error('  state-transition.ts --issue=123 --to=implementing --reason="Starting implementation"');
    process.exit(1);
  }

  return { issue, to, reason };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const config = getConfig();

    const client = new GitHubClient(
      config.github.token,
      config.github.owner,
      config.github.repo
    );

    console.log(`🔄 Transitioning Issue #${args.issue} to state: ${args.to}`);
    console.log(`📝 Reason: ${args.reason}`);

    await client.transitionState(args.issue, args.to, args.reason);

    console.log(`✅ State transition completed for Issue #${args.issue}`);
  } catch (error) {
    console.error('❌ Error during state transition:', error);
    process.exit(1);
  }
}

main();
