# Kinds of research

The research exists to serve the story: to prove or kill the first guess,
and above all to find the **surprise**, the fact that makes the viewer stop.
Long findings go in `research.md`; the outline carries only what the story
uses. Big research can run in background agents.

Pick one or more:

| Kind | When | Output |
|---|---|---|
| Desk research | Published studies, data, reports exist | `research.md` |
| Your own study | Nobody has the data; you collect it | `study/` + `research.md` |
| Conversation prep | An interview or guest video | `research.md` (+ conversation outline) |
| None | The knowledge is the company's own | the outline's *Needs from the speaker* |

## The research rules (always)

The profile's *Research rules* always apply. On top of them, a skill never:
- contacts, calls, messages or emails anyone;
- submits a form, books a slot, or starts a chat on someone's site;
- logs in anywhere, or pays for anything.

Reading public pages is fine. If a piece of evidence would need one of the
actions above, report it as "can't check" and move on.

## Desk research

- Every number gets a source: who, title, link, date.
- Prefer primary sources (the study itself, the official data) over
  articles about them.
- Say how strong it is: sample size, who paid for it, how old it is. A
  weak number is either labelled as weak in the outline, or cut.
- Write down the numbers that went against the story too. If the evidence
  kills the first guess, the story changes; say so in the outline.

## Your own study

Collecting your own data (for example, reading 40 public websites or job
ads against fixed criteria) is often the strongest "only us" content. In
this version the skill runs the study itself, with background agents,
inside the research rules.

**The study gate.** The criteria are fixed before any data is collected, so
they can't be chosen to fit the results.

1. Write `study/method.md`: the question, what will be read, how, and what
   can't be checked.
2. Write `study/sample.md`: how the sample is chosen (where from, how many,
   what's left out). The rule is fixed at the gate; the list itself may be
   drawn after approval, by that rule, before anything is scored.
3. Write `study/criteria.md`: each criterion as a question, with what counts
   as yes / partly / no, where the evidence is looked for, and its weak
   spots; the scoring and tie-break rules; open decisions for the human.
4. Registry → `researching`, note `study gate: criteria sent`. **Stop.**
   Ask the human to write `Approved` as the first line of
   `study/criteria.md` once the criteria are right.
5. Only when `criteria.md` passes the approval-word rule (workspace.md):
   collect. Results go in `study/results.md`, raw data beside it (one file
   per item, or one table), with the evidence for each judgement.
6. **Second reader:** an agent that hasn't seen the first scores re-scores
   a random tenth of the sample. Report how often they agree; a criterion
   with poor agreement goes back to the human before results are used.
7. Registry note `study: results in`. Continue with the outline.

Because studies take days, content-ideation offers to start the gate as
soon as the human keeps the idea.

## Conversation prep

For a `conversation` video:
- **Who to invite, and why:** what they know that the viewer needs, and why
  they'd say yes.
- **The questions,** in the order of the question flow (outline-format.md).
- **The invitation**, under `## Outreach draft` in `research.md`, headed
  **"Draft for a person to send."** The skill never sends it.

## None

When the story rests on the company's own knowledge, there's no research
step. The outline lists everything the speaker must supply under *Needs
from the speaker (⚠)*.
