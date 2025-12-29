import { config as loadEnv } from 'dotenv';
import type { MiyabiConfig } from '../types/index.js';

// Load environment variables
loadEnv();

export function loadConfig(): MiyabiConfig {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubOwner = process.env.GITHUB_OWNER ?? process.env.GITHUB_REPOSITORY_OWNER;
  const githubRepo = process.env.GITHUB_REPO ?? process.env.GITHUB_REPOSITORY?.split('/')[1];

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN is required');
  }

  if (!githubOwner || !githubRepo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO are required');
  }

  return {
    github: {
      token: githubToken,
      owner: githubOwner,
      repo: githubRepo,
    },
    anthropic: process.env.ANTHROPIC_API_KEY
      ? {
          apiKey: process.env.ANTHROPIC_API_KEY,
        }
      : undefined,
    agents: {
      enabled: ['coordinator', 'issue', 'codegen', 'review', 'pr', 'deployment', 'test'],
    },
  };
}

export function getConfig(): MiyabiConfig {
  try {
    return loadConfig();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw error;
  }
}
