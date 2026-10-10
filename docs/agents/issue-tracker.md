# Issue tracker: GitHub

Issues and specs live in GitHub Issues for Adam26114/qr-pos-mm.
Use the gh CLI from this clone; it infers the repo from the remote.

## Conventions

- Create: gh issue create --title "..." --body-file <file>
- Read: gh issue view <number> --comments
- List: gh issue list --state open --json number,title,body,labels
- Comment: gh issue comment <number> --body-file <file>
- Apply/remove labels: gh issue edit <number> --add-label "..."
  or --remove-label "..."
- Close: gh issue close <number> --comment "..."

Use temporary files for multiline issue bodies and comments.

## Pull requests as a triage surface

PRs as a request surface: no.

## Skill operations

"Publish to the issue tracker" means create a GitHub issue.
"Fetch the relevant ticket" means read the issue and its comments.

## Wayfinding operations

- Map: one issue labelled wayfinder:map, containing Notes,
  Decisions-so-far, and Fog.
- Child tickets: link as GitHub sub-issues. If unavailable, use a
  task list in the map and "Part of #<map>" in each child.
- Ticket labels: wayfinder:research, wayfinder:prototype,
  wayfinder:grilling, or wayfinder:task.
- Blocking: use native GitHub issue dependencies via gh api,
  using the blocker's database ID. If unavailable, record
  "Blocked by: #<number>" in the child.
- Frontier: choose the first open child in map order with no
  open blockers and no assignee.
- Claim: gh issue edit <number> --add-assignee @me.
- Resolve: comment with the answer, close the child, and append
  a summary and context link to the map's Decisions-so-far.
