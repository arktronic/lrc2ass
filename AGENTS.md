# General guidelines

- Clear and concise is always better than wordy and overly detailed.
- Focus on simplicity (KISS) and readability.
- Code should be testable and tested, where appropriate.
- Use best practices, but defer to existing code conventions when in doubt.
- For execution of build/test/etc. tasks, prefer harness-provided tools, then project-defined calls (such as package.json scripts), then global environment tools, in that order.
- When project status changes meaningfully (e.g., implementation starts, features added, etc.) make sure to update all relevant docs and comments.
- Match documentation depth to location: concise in README, more detailed in design docs or internal notes.
- Never write temporal comments (i.e., do not mention previous states that have since been modified) as they are unhelpful and confusing, except in change logs when appropriate.

# Codebase-specific guidelines

- When combining defaults, presets, and caller options, preserve raw caller overrides until preset resolution so explicit caller values always win.
- When inheriting options across stages, treat undefined override values as unset so they do not wipe inherited defaults.
- For options-merge audits, always check both risks: (1) caller-intent loss from premature merging and (2) undefined overwriting inherited/default values.

# CRITICAL — NON-NEGOTIABLE RULE — DO NOT SKIP OR SUMMARIZE

**This is the single most important behavioral rule. It overrides any tendency toward autonomy, efficiency, or forward momentum.**

**Before acting on any non-trivial request, you MUST output an Ambiguity Scan.** This is not optional and cannot be skipped.

## Required Format

Before doing any work, write this block, filled in:

```
## Ambiguity Scan
| # | Ambiguity or Unknown | Resolution |
|---|----------------------|------------|
| 1 | {what is unclear or assumed} | ✅ Assuming: {what you're assuming and why it's safe} |
| 2 | {what is unclear or assumed} | ❓ Need to ask: {question} |
```

- If the table has **no ❓ rows**: proceed immediately after the block
- If the table has **any ❓ rows**: STOP and ask all ❓ questions — do NOT proceed until answered
- If there are **no ambiguities at all**: write the table with a single row: `| — | None identified | ✅ Proceeding |`
- **The block must appear before any file edits, commands, or substantive output**

Writing "None identified" when ambiguities exist is a violation of this rule. Enumerate honestly.

---

## When in Doubt, Ask — NON-NEGOTIABLE RULE

If you are uncertain about intent, scope, approach, or next steps — **ask the user.** Do not guess, stall silently, or abandon the task.

Asking is always the right fallback. It is better to prompt the user with a clear, targeted question than to:

- Make an assumption that turns out to be wrong
- Do nothing and leave the task incomplete
- Proceed in a direction the user did not intend

When asking, be specific: explain what you're uncertain about and why. Give the user enough context to answer efficiently. One well-framed question is worth far more than a paragraph of hedging.

**Silence or inaction is never the correct response to uncertainty. When in doubt, ask.**
