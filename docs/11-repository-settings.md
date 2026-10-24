# GitHub repository settings

Verified on 2026-10-24 for `Gareji-AI/agentmeter` through GitHub's REST API.
The repository remains **private** and the organization remains **GitHub Free**.

## Applied settings

- English description, public information homepage and 12 relevant Topics.
- Default branch `main`; squash merging only; delete merged topic branches.
- Squash commits use the pull request title and description. Automatic merging is off.
- Issues enabled; unused Projects and Wiki disabled.
- Actions enabled with GitHub-owned actions allowed and full commit SHA pinning required.
- Workflow tokens default to read-only and cannot approve pull requests.
- Existing CI uses a standard Ubuntu runner, Node 26, a five-minute timeout and
  cancellation of superseded runs. It runs `npm test` and `npm run verify:demo`.
  No package install, paid runner, artifact upload or deployment step is needed.

The metadata payloads are versioned in `.github/repository-settings.json` and
`.github/topics.json`. They can be reapplied with `gh api --method PATCH
repos/Gareji-AI/agentmeter --input .github/repository-settings.json` and `gh api
--method PUT repos/Gareji-AI/agentmeter/topics --input .github/topics.json`.

## Spending controls

Existing organization-wide budgets already cover this repository. Each of
`actions`, `packages`, `codespaces` and `git_lfs` has `budget_amount: 0` and
`prevent_further_usage: true`. These controls were read back and preserved;
no other repository's settings or organization-wide budgets were changed.
The included free usage remains subject to GitHub's allowance and limits.
When it runs out, do not raise the budget to restart CI; run the same checks locally.

No paid plan, trial, security subscription, seat or Marketplace purchase was added.
These GitHub limits do not change the separately authorized Render backend charges.
Budgets control future metered usage from their creation date; they do not establish
that all historical charges or separately purchased subscriptions are zero.

Read-only recheck commands:

```sh
gh api orgs/Gareji-AI --jq '.plan.name'
gh api organizations/Gareji-AI/settings/billing/budgets
gh api repos/Gareji-AI/agentmeter/actions/permissions
gh api repos/Gareji-AI/agentmeter/actions/permissions/workflow
```

See [GitHub budgets](https://docs.github.com/en/billing/concepts/budgets-and-alerts).

## Branch protection: pending, not enforced

GitHub Free for organizations does not enforce branch protection or repository
rulesets on this **private** repository. Both read endpoints returned HTTP 403 with
an upgrade/public-visibility requirement. Merge preferences and passing CI do not
prevent a direct push, force push or branch deletion. There is currently **no
server-side branch protection** on `main`.

`.github/main-protection.pending.json` is an unapplied API payload. It would require
a pull request, a successful up-to-date GitHub Actions `test` check, resolved review
threads and linear history; it would prohibit force pushes and deletion, including
for administrators. It requires zero approving reviews so the solo maintainer can
merge their own pull request. The check name and GitHub Actions app ID were taken
from the successful CI run for `cbe5543`.

If the owner separately authorizes public release, GitHub Free supports this
protection on public repositories. After auditing the repository for release,
confirming a fresh successful `test` check and preparing to use pull requests, apply:

```sh
gh api --method PUT repos/Gareji-AI/agentmeter/branches/main/protection \
  --input .github/main-protection.pending.json
gh api repos/Gareji-AI/agentmeter/branches/main/protection
```

Do not change visibility or upgrade the plan to make this command work without
the owner's separate authorization. Until then, use `codex/` topic branches,
pull requests and local verification as workflow conventions only.
See [GitHub branch protection availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
