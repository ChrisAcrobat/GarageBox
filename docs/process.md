# Process: build, refactoring and QA

How a piece of work goes from the docs to a finished build. The design bot writes requirements, design, README and tests and never writes in `src/`; developer bots own `src/`.

## 1. Before a build starts

- The design bot asks the owner whether the build is **attended** or **unattended**.
  - **Attended:** the owner can answer questions. Unclear points are asked to the owner (one question at a time), and work on that point waits for the answer.
  - **Unattended:** nobody can answer questions for now. The bot that hits an unclear point does not stop: it takes the most reasonable decision, logs it as a decision file in [`decisions-review/`](../decisions-review/README.md) (decision, why, alternatives, where, importance) and commits it right away. The owner reviews and confirms these decisions afterwards.
- The default is attended: when in doubt, ask the owner.

## 2. Steps

1. **Build.** A developer bot implements the agreed part from the docs, runs all tests, and finishes by cleaning up its own code (no behaviour change). Status: "Arbetar", then "Väntar på QA". A status names what the bot is waiting for and never says "Klar".
2. **Refactoring.** A separate refactoring bot reviews the code with fresh eyes and refactors it (structure, names, duplication) **without changing behaviour**. All tests must give the same result before and after. Exception: if a module is already hard to work with before a large build, it may be refactored before that build instead.
3. **QA.** The design bot tests the result against the docs (requirements, design, tests).
4. **Owner test.** When QA passes, the owner tests on the real hardware (e.g. the guitar). Defects found there go through the same defect flow as QA defects. While the owner tests, the build bots have the status "Väntar på användartest".

## 3. QA defects

1. **QA report.** For each defect: the requirement ID, what should happen, what happens, and how to reproduce it.
2. **Sorting.**
   - Wrong code goes back to the bot that made the defect, since it has the context (a test that breaks after the refactoring goes to the refactoring bot).
   - An unclear or contradictory doc is the design bot's defect: it fixes the doc, and if that needs a new decision it asks the owner (attended) or decides and logs it (unattended).
3. **Fix.** The bot sets its status to "Åtgärdar QA-fel", fixes the defect, adds a test that catches it where possible, runs all tests and sets "Väntar på QA" again.
4. **Re-test.** The design bot re-tests the failed points and runs the whole test suite to make sure nothing else broke.
5. **Limit.** If the same point still fails after **5 rounds**, the design bot takes it to the owner (attended). In an unattended build the work may go on up to **10 rounds**; after that the design bot decides how to proceed (e.g. a different approach or a simpler requirement), logs the decision in `decisions-review/` and the point is reviewed with the owner afterwards.

## 4. Done

When QA and the owner test pass, the developer bots set their status to "Färdig, redo att tas bort". Only the owner deletes bots.
