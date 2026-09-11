# On-demand Vercel previews

After relevant CI passes, apply one label to request a Preview of that exact PR head:

| Label | Vercel project |
| --- | --- |
| `preview` | `mainstreet-advisory-ca4y` |

Remove and reapply the label to preview a newer SHA. Subsequent pushes do not request another Preview automatically. A label deploys only its listed project. The workflow posts a URL after Vercel reports READY and its project, Preview target and SHA match.

Git auto-deploy remains enabled for `main`; other branches are disabled with `**`, including nested branch names. Existing application CI is unchanged.

Setup: create these repository labels and configure the `VERCEL_TOKEN` Actions secret with an approved deploy-capable credential for the listed project(s). Team/project IDs are explicit non-secret identifiers in the workflow. The token is used only by the base-branch workflow's API request; no PR checkout or application script runs in that job. Fork PRs are rejected. Vercel author-access checks still apply.

This workflow does not enforce green application CI or create isolated databases. The requester must check CI and effective Preview credentials before applying a label, then perform approved read-only smoke checks. Preview can still access existing live data/integrations. A Preview URL is not permission to seed data, send messages or run migrations.

Rollout: merge into the default branch, then update existing PR branches from it so their Vercel configuration includes the policy. Update any separately maintained deployment branch as part of its approved release. Test one intentional Preview against a known-safe configuration before declaring hosted verification complete. Merging still invokes existing Production build behavior.

Run `node scripts/check-preview-policy.mjs` with Node.js 24 for the dependency-free policy and mocked API checks. The check also runs in GitHub Actions when these files change.
