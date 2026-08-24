# Early GitHub Handoff v1

Owner: Prometheus Infrastructure

The governed dispatcher minimizes Founder laptop time without changing any
accepted qualification, deployment, rollback, evidence, or protected-state
control. It requires a clean synchronized branch, binds the workflow inputs to
the exact commit SHA and tree, dispatches through the GitHub Actions API, and
locates the result using the exact commit SHA, branch, workflow identity, and
dispatch timestamp.

## Usage

The default no-secret repository qualification is:

```sh
node scripts/run-early-github-handoff-v1.mjs \
  --commit "$(git rev-parse HEAD)" \
  --tree "$(git rev-parse HEAD^{tree})"
```

For another already governed manual workflow, provide `--workflow` and a
nonsecret JSON input file. The dispatcher always injects `candidate_commit` and
`candidate_tree` and rejects a conflicting value for either identity.

```sh
node scripts/run-early-github-handoff-v1.mjs \
  --workflow governed-workflow.yml \
  --branch main \
  --commit "$(git rev-parse HEAD)" \
  --tree "$(git rev-parse HEAD^{tree})" \
  --inputs-json /absolute/path/to/nonsecret-inputs.json
```

Authentication comes only from `GH_TOKEN` or `GITHUB_TOKEN`. Authentication
and API failures return fixed classifications and never include response
bodies, headers, or credential material.

After GitHub returns an accepted dispatch, the command polls only the selected
workflow. One exact match produces the run ID and URL. No match before the
bounded deadline reports accepted registration pending. Multiple matches fail
closed. The Founder-close status is impossible unless the dispatch was accepted
and the repository preflight proved no local work remained.

The dedicated hosted workflow runs on `workflow_dispatch` only, receives no
production environment or secret, verifies the exact synchronized `main`
commit, runs the complete repository qualification, and cannot deploy.
