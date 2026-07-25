# Eye Guide Confirmation Lock and Test Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent one confirmation utterance from skipping multiple guide pages, accept all supported confirmation phrases, and align the bilingual/test-level typography with the approved layout.

**Architecture:** Keep recognition lifecycle inside the existing voice controllers, but add a synchronous application-level confirmation gate around page transitions. Reuse the existing optotype metadata and reference-word elements, changing only their placement and shared styles.

**Tech Stack:** React 19, TypeScript, Vosk Browser, Vitest, Testing Library, CSS, Vite.

## Global Constraints

- Preparation and eye-guide pages remain voice-first with no red confirmation button.
- A page accepts confirmation only after its own spoken prompt and 400ms quiet interval finish.
- One utterance can advance only one page.
- Direction recognition behavior remains unchanged.
- Chinese and English reference words use the same font size, color, weight, font family, and letter spacing.
- Eye label and five-point level share a 13px top metadata row.
- Do not update `edgeone-upload` until local microphone acceptance succeeds.

---

### Task 1: Lock confirmation to one guide page

**Files:**
- Modify: `src/App.voiceFallback.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useVoiceInput(onCommand, scope)` callback and existing `playPrompt()` lifecycle.
- Produces: a synchronous `confirmationReadyRef` gate owned by `App`.

- [ ] **Step 1: Write the failing page-transition test**

Capture the real `onCommand` callback in the voice test double, finish the setup prompt, emit `confirm` twice synchronously, and assert the app remains on `测试右眼` instead of reaching countdown. After the eye-guide prompt finishes, emit one new `confirm` and assert countdown begins.

- [ ] **Step 2: Run the focused test and verify RED**

Run `node node_modules/vitest/vitest.mjs run src/App.voiceFallback.test.tsx` and expect the duplicate confirmation test to fail because the second callback reaches `confirmCurrentStep()`.

- [ ] **Step 3: Implement the minimal synchronous gate**

Add `confirmationReadyRef`. Set it to `false` before each prompt and immediately when a confirmation is accepted. Set it to `true` only after `resumeVoice()` succeeds for the current prompt run. Reset it in `resetTest()`. Reject confirmation callbacks while it is false.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same Vitest command and expect all `App.voiceFallback` tests to pass.

### Task 2: Complete confirmation phrase normalization

**Files:**
- Modify: `src/voice/voice.test.ts`
- Modify: `src/voice/contracts.ts`

**Interfaces:**
- Consumes: `normalizeVoiceCommand(spoken: string): VoiceCommand | null`.
- Produces: normalization for every confirmation phrase already present in Vosk `COMMAND_GRAMMAR`.

- [ ] **Step 1: Write a failing table-driven normalization test**

Use literal cases for `好`, `好了`, `我好了`, `可以了`, `准备好`, `我准备好了`, `欧`, `哦`, `喔`, `噢`, `欧了`, and `哦了`; expect each result to equal `confirm`.

- [ ] **Step 2: Run the focused voice test and verify RED**

Run `node node_modules/vitest/vitest.mjs run src/voice/voice.test.ts` and expect the first currently unmapped phrase to return `null`.

- [ ] **Step 3: Add the missing literal mappings**

Extend `commandMap` only; do not add fuzzy matching or change direction commands.

- [ ] **Step 4: Run the focused voice test and verify GREEN**

Run the same Vitest command and expect all voice tests to pass.

### Task 3: Align test metadata and bilingual typography

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `TestPage` values `eye`, `state.level`, and `referenceWord`.
- Produces: `.test-meta` containing eye and level; identically styled `.reference-word` and `.reference-word-meaning`.

- [ ] **Step 1: Write failing component assertions**

Assert that the current level is a child of `.test-meta`, and that the English and Chinese elements receive equal inline `fontSize`, `color`, `fontWeight`, `fontFamily`, and `letterSpacing` styles.

- [ ] **Step 2: Run the focused component test and verify RED**

Run `node node_modules/vitest/vitest.mjs run src/App.test.tsx` and expect the metadata parent/style equality assertions to fail.

- [ ] **Step 3: Implement the approved layout**

Move `.optotype-level` into `.test-meta`, set the metadata row to 13px, and remove fixed center-left positioning. Create one `CSSProperties` reference-word style object and apply it to both English and Chinese spans while preserving the existing two-line gap.

- [ ] **Step 4: Run the focused component test and verify GREEN**

Run the same Vitest command and expect all `App` tests to pass.

### Task 4: Full verification and local handoff

**Files:**
- Verify only: all changed source and test files
- Rebuild: `dist/`

- [ ] **Step 1: Run complete automated verification**

Run all Vitest tests, ESLint, and `tsc -b --pretty false`; require zero failures.

- [ ] **Step 2: Build and verify production artifacts**

Run Vite build, Vosk model splitting, EdgeOne preparation, and EdgeOne verification scripts in order; require successful hash and file-size verification.

- [ ] **Step 3: Restart local production preview**

Serve `dist` at `http://127.0.0.1:4174/`, verify HTTP 200 plus COOP/COEP headers, and open the acceptance URL.

- [ ] **Step 4: Request real microphone acceptance**

Ask the user to speak one confirmation per page, verify no guide page skips, and verify the revised test-page typography before any EdgeOne upload.
