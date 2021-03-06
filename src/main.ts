import * as core from '@actions/core';
import * as github from '@actions/github';
import { WebhookPayload } from '@actions/github/lib/interfaces';

import config, { match } from './config';

interface PullRequestWebhookPayload extends WebhookPayload {
  // eslint-disable-next-line camelcase
  pull_request?: {
    [key: string]: any;
    number: number;
    // eslint-disable-next-line camelcase
    html_url?: string;
    body?: string;

    milestone?: string;
    base: {
      ref: string;
    },
    head: {
      ref: string;
    },
  },
}

async function run() {
  const token = core.getInput('repo-token', { required: true });
  const configPath = core.getInput('configuration-path', { required: false });
  const milestoneOverride = core.getInput('milestone', { required: false });

  const pullRequest = (github.context.payload as PullRequestWebhookPayload).pull_request;
  if (!pullRequest) {
    console.log('Could not get pull_request from context, exiting');
    return;
  }

  const {
    milestone,
    number: prNumber,
    base: { ref: baseBranch },
    head: { ref: headBranch },
  } = pullRequest;

  if (!milestoneOverride && milestone) {
    console.log(`Milestone already exists, exiting (milestone: ${milestone})`);
    return;
  }

  const client = new github.GitHub(token);
  var addMilestone;
  if (!milestoneOverride) {
    const configObject = await config(client, configPath);
    console.log('configObject base-branch', configObject.baseBranchList);
    console.log('configObject head-branch', configObject.headBranchList);

    addMilestone = match(baseBranch, headBranch, configObject);

    if (!addMilestone) {
      console.log('Milestone not hit, exiting');
      return;
    }
  } else {
    addMilestone = milestoneOverride;
  }

  const milestones = await client.issues.listMilestonesForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  });
  const { number: milestoneNumber } = milestones.data.find(({ title }) => title === addMilestone)
    || {};

  if (milestoneNumber) {
    await client.issues.update({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: prNumber,
      milestone: milestoneNumber,
    });
    core.setOutput('milestone', addMilestone);
  } else {
    console.log(`Milestone not found, Please create it first "${addMilestone}".`);
  }
}

run().catch((error) => {
  core.setFailed(error.message);
});
