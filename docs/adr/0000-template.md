# NNNN. Short title in plain words

- **Status:** Proposed | Accepted | Superseded by NNNN | Deprecated
- **Date:** YYYY-MM-DD
- **Decided by:** Bipin A / Darshan H.S. / the agent that proposed it

## Context

What is true right now that forces a choice. Constraints, deadlines, platform limits, what we tried first. Write it so someone with no memory of this week understands the pressure you were under.

## Decision

What we are doing, in one or two sentences, in the present tense.

> We store the plan's steps as one `jsonb` document rather than a row per step.

## Alternatives considered

| Option | Why not |
|---|---|
| … | … |

Be fair to the ones you rejected. An ADR that makes the alternatives look stupid is not a record, it is a defence.

## Consequences

**Good**
- …

**Bad, and accepted**
- …

**What this now constrains**
- What becomes harder, and what would have to change to undo this.

## Revisit when

A concrete trigger, not "later". For example: *when the API is hosted*, *when a plan exceeds 200 steps*, *when we move to a paid Groq tier*.
