# Launch Incident Response & Rollback Plan

This document describes how to respond if the public launch triggers a bug
flood, security issue, or reputational incident.

## Severity Levels

| Level | Trigger                                                       | Response Time |
| ----- | ------------------------------------------------------------- | ------------- |
| P0    | Install broken on a supported OS, data loss, security breach  | Immediate     |
| P1    | Core feature broken (Ollama detection, permission mode, auth) | < 2 hours     |
| P2    | UI bug, typo, non-critical docs issue                         | < 24 hours    |

## Response Team

- **Launch Captain:** Orchestrator
- **Engineering:** who cut the release
- **Community:** GitHub Issues triage until a public community channel exists
- **Comms:** person who drafted launch copy

## Communication Channels

- Internal triage: GitHub Issues with `launch-incident` labels until a public
  community channel and moderator schedule exist.
- Public status: GitHub issue titled `[Launch Status] YYYY-MM-DD incident summary`
- Rollback notice: reply to HN post and update Twitter/Mastodon; do not claim a
  Discord announcement channel exists until it is created.

## Rollback Procedures

### npm Package Rollback

```bash
# Unpublish is only possible within 72 hours of publish
npm unpublish savant-code@<bad-version>
# Or deprecate if unpublish is not possible
npm deprecate savant-code@<bad-version> \
  "Critical issue, install <fixed-version> instead"
```

### GitHub Release Rollback

1. Delete the bad release tag.
2. Revert the problematic commit via a hotfix branch.
3. Push a new patch release.
4. Update `CHANGELOG.md` and `VERSION`.

### Landing Page Rollback

1. If a broken landing page is deployed, push a revert to the hosting branch.
2. Verify DNS/cache invalidation (Cloudflare/GitHub Pages).

### Social Amplification Pause

1. Stop scheduled tweets/threads.
2. Update the pinned HN comment with: "We are seeing reports of [issue]. We have
   paused amplification and are cutting a patch."
3. Do NOT delete the HN post; transparency is valued on HN.

## Triage Workflow

1. Collect reproductions in GitHub issues with a `launch-incident` label.
2. Route Ollama and auth/BYOK issues to labeled GitHub Issues until dedicated
   community channels exist.
3. Reproduce locally on the target OS before declaring root cause.
4. Cut a hotfix release and verify against the reproduction.
5. Post a public incident summary in the GitHub issue and update only the
   launch channels that actually exist.

## Shadowban / Flagging Response

If the HN post is flagged or domain shadowbanned:

1. Do not coordinate upvotes.
2. Post a factual, humble comment acknowledging any mistake.
3. If the post is killed, use the blog/landing page as the primary link for
   subsequent sharing.
4. Do not create duplicate posts the same day.

## Post-Mortem

Within 48 hours of any P0/P1 incident, publish a post-mortem covering:

- Timeline
- Root cause
- Fix applied
- Prevention measures
- Apology if users were affected
