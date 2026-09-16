# Security phase prompts

Each linked file is a standalone prompt: copy its **entire contents** into an AI agent that can access this repository. Start with Phase 2 and proceed in order after testing and accepting the preceding phase. Do not paste all phases at once.

The prompts include project context, the specific problem, implementation boundaries, acceptance scenarios, required checks, and a mandatory second review. They instruct the agent to implement only one phase and leave production deployment and Git commits/pushes to you.

## Prompts

- [Phase 2 — Public business-card lookup](phase-2-prompt-public-business-card-lookup.md)
- [Phase 3 — Portal identity and profile access](phase-3-prompt-portal-identity-and-profile-access.md)
- [Phase 4 — Administration membership operations](phase-4-prompt-administration-membership-operations.md)
- [Phase 5 — DTR organization setup and assignments](phase-5-prompt-dtr-organization-setup-and-assignments.md)
- [Phase 6 — Authenticated business-card operations](phase-6-prompt-authenticated-business-card-operations.md)
- [Phase 7 — DTR reads and employee scope](phase-7-prompt-dtr-reads-and-employee-scope.md)
- [Phase 8 — DTR saves, submission, and approval](phase-8-prompt-dtr-saves-submission-and-approval.md)
- [Phase 9 — Remaining SQL audit and completion](phase-9-prompt-remaining-sql-audit-and-completion.md)

## Before starting a phase

- Use [the master plan](security-fix-plan.md) to record which previous phase you tested and accepted. If its status is stale, tell the agent explicitly what you tested; a successful local login alone is not full production verification.
- Give the agent access to the current repository and let it read `AGENTS.md`. These prompts reference repository-relative paths so they also work in another checkout.
- Specify any new constraints and, if relevant, the previous phase's release identifier. Never paste passwords, tokens, or real employee records into the prompt.
- Review the agent's changed files and actual test results before deploying frontend and backend together. Keep the phase marked **Implemented** until deployment and the applicable production checks are confirmed.

These files are instructions for future work; creating them does not implement or verify Phases 2–9. When later work changes interfaces or dependencies, update the remaining prompts to match the confirmed implementation and master plan.

