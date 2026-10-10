# Domain Docs

## Layout

This repo uses single-context domain documentation:

- CONTEXT.md at the repo root: shared domain glossary and context.
- docs/adr/: architectural decision records.

Workspaces share this documentation.

## Before exploring

Read CONTEXT.md and ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Do not flag their
absence or suggest creating them upfront. The domain-modeling
skill creates them lazily as terms and decisions are resolved.

## Vocabulary

Use the terms defined in CONTEXT.md in issue titles, proposals,
hypotheses, and test names. Avoid synonyms the glossary excludes.

If a concept is missing, reconsider whether it belongs to the
project's vocabulary or note the gap for domain-modeling.

## ADR conflicts

Explicitly flag proposals that contradict an existing ADR,
identify the ADR, and explain why it should be reconsidered.
