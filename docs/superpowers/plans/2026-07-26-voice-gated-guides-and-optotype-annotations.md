# Voice-Gated Guides and Optotype Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent spoken instructions from advancing preparation screens, provide non-sticky voice feedback, and annotate every optotype with its five-point level plus bilingual reference text.

**Architecture:** Keep the loaded Vosk controller alive while adding pause/resume audio gating at the controller boundary. Let `App` coordinate prompt playback and clear transient feedback on context changes. Move reference-word translations into the reference-word domain module and render them as one annotation group in `TestPage`.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, Testing Library, Vosk Browser.

## Global Constraints

- Vosk remains the default engine and recognition remains local after the model download.
- Prompt playback pauses recognizer audio input; listening resumes 400 ms after playback settles.
- Preparation and eye-guide pages contain no red continue button.
- Enter remains a non-visual accessibility fallback.
- Temporary heard/missed feedback clears after 1.5 seconds and on question, eye, or page changes.
- Direction buttons appear only when voice is permanently unavailable.
- The level label remains visible when bilingual reference words are disabled.

---

### Task 1: Pausable Voice Controller

**Files:**
- Modify: `src/voice/contracts.ts`
- Modify: `src/voice/vosk.ts`
- Modify: `src/voice/webSpeech.ts`
- Modify: `src/voice/rhino.ts`
- Modify: `src/voice/useVoiceInput.ts`
- Test: `src/voice/voice.test.ts`
- Test: `src/voice/webSpeech.test.ts`

**Interfaces:**
- Produces: `VoiceController.pause(): Promise<void>` and `VoiceController.resume(): Promise<void>`.
- Produces: `useVoiceInput(...).pause()`, `.resume()`, and `.clearTransientFeedback()`.
- `pause()` retains the loaded model and prevents commands; `resume()` restores audio processing without reloading.

- [ ] **Step 1: Write failing controller tests**

```ts
await controller?.pause()
processor.onaudioprocess?.({ inputBuffer: audioBuffer })
expect(acceptWaveform).not.toHaveBeenCalled()
await controller?.resume()
processor.onaudioprocess?.({ inputBuffer: audioBuffer })
expect(acceptWaveform).toHaveBeenCalledOnce()
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/voice/voice.test.ts src/voice/webSpeech.test.ts`

Expected: FAIL because controllers do not expose `pause` or `resume` and Vosk still accepts paused audio.

- [ ] **Step 3: Implement the controller contract and hook forwarding**

```ts
export interface VoiceController {
  readonly engine: Exclude<VoiceEngineId, 'keyboard'>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
}
```

Vosk keeps `paused` state and skips `acceptWaveform` while paused. Web Speech aborts while paused and restarts on resume. Rhino stops processing while paused. `useVoiceInput` forwards these lifecycle calls and clears only transient `fallback`/heard details.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node node_modules/vitest/vitest.mjs run src/voice/voice.test.ts src/voice/webSpeech.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add src/voice/contracts.ts src/voice/vosk.ts src/voice/webSpeech.ts src/voice/rhino.ts src/voice/useVoiceInput.ts src/voice/voice.test.ts src/voice/webSpeech.test.ts
git commit -m "fix: gate recognition during spoken prompts"
```

### Task 2: Voice-Only Preparation Screens

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.voiceFallback.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `pause()`, `resume()`, and `clearTransientFeedback()` from Task 1.
- Produces: prompt playback state and contextual status copy for setup, eye-guide, and direction-test scopes.

- [ ] **Step 1: Write failing page and prompt-gating tests**

```tsx
expect(screen.queryByRole('button', { name: /开始测试/ })).not.toBeInTheDocument()
expect(screen.getByRole('status')).toHaveTextContent('正在播报提示')
expect(voice.pause).toHaveBeenCalledBefore(voice.resume)
```

Also assert that setup and eye-guide listening copy says `准备好了`, while the test page says `上、下、左、右`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/App.voiceFallback.test.tsx src/App.test.tsx`

Expected: FAIL because the setup button remains and prompt playback does not pause recognition.

- [ ] **Step 3: Implement prompt gating and remove the button**

```ts
await voice.pause()
setPromptPlaying(true)
await speakInstruction(text)
await new Promise((resolve) => window.setTimeout(resolve, 400))
await voice.resume()
setPromptPlaying(false)
```

Guard confirm commands while prompt playback is active. Remove `.setup-continue-button` and `.setup-continue-hint`; retain Enter handling only after loading/prompt playback ends. Clear transient feedback when `view`, `eye`, or `answers.length` changes.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node node_modules/vitest/vitest.mjs run src/App.voiceFallback.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit only Task 2 files**

```bash
git add src/App.tsx src/styles.css src/App.voiceFallback.test.tsx src/App.test.tsx
git commit -m "fix: make preparation screens voice gated"
```

### Task 3: Bilingual Reference Word Data

**Files:**
- Modify: `src/domain/referenceWords.ts`
- Modify: `src/domain/referenceWords.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `ReferenceWord = { en: string; zh: string }`.
- Produces: `selectNextReferenceWord(history: readonly string[], random?: () => number): ReferenceWord`.

- [ ] **Step 1: Write failing translation tests**

```ts
expect(REFERENCE_WORDS.every(({ en, zh }) => /^[a-z]{3,6}$/.test(en) && zh.length > 0)).toBe(true)
expect(new Set(REFERENCE_WORDS.map(({ en }) => en)).size).toBe(REFERENCE_WORDS.length)
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/domain/referenceWords.test.ts`

Expected: FAIL because entries are strings rather than bilingual objects.

- [ ] **Step 3: Add explicit translations and update selection state**

```ts
export interface ReferenceWord { readonly en: string; readonly zh: string }
export const REFERENCE_WORDS: readonly ReferenceWord[] = [
  { en: 'sky', zh: '天空' },
  { en: 'cloud', zh: '云' },
  { en: 'hill', zh: '小山' },
  { en: 'tree', zh: '树' },
  { en: 'grass', zh: '草地' },
  { en: 'field', zh: '田野' },
  { en: 'garden', zh: '花园' },
  { en: 'school', zh: '学校' },
  { en: 'class', zh: '课堂' },
  { en: 'pencil', zh: '铅笔' },
  { en: 'desk', zh: '书桌' },
  { en: 'board', zh: '黑板' },
  { en: 'road', zh: '道路' },
  { en: 'light', zh: '灯光' },
  { en: 'train', zh: '火车' },
  { en: 'sign', zh: '标志' },
  { en: 'door', zh: '门' },
  { en: 'stair', zh: '楼梯' },
  { en: 'rain', zh: '雨' },
  { en: 'water', zh: '水' },
  { en: 'cup', zh: '杯子' },
  { en: 'friend', zh: '朋友' },
  { en: 'street', zh: '街道' },
  { en: 'shop', zh: '商店' },
  { en: 'park', zh: '公园' },
  { en: 'river', zh: '河流' },
  { en: 'bridge', zh: '桥' },
  { en: 'bird', zh: '鸟' },
  { en: 'kite', zh: '风筝' },
  { en: 'bike', zh: '自行车' },
  { en: 'bus', zh: '公交车' },
  { en: 'home', zh: '家' },
  { en: 'beach', zh: '海滩' },
  { en: 'woods', zh: '树林' },
  { en: 'roof', zh: '屋顶' },
  { en: 'sun', zh: '太阳' },
]
```

Keep history as English keys and pass `referenceWord.en` into sizing logic.

- [ ] **Step 4: Run domain and app tests**

Run: `node node_modules/vitest/vitest.mjs run src/domain/referenceWords.test.ts src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit Task 3 files**

```bash
git add src/domain/referenceWords.ts src/domain/referenceWords.test.ts src/App.tsx
git commit -m "feat: add Chinese reference-word meanings"
```

### Task 4: Optotype Level and Annotation Layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `ReferenceWord` from Task 3.
- Produces: `.optotype-level`, `.reference-word-group`, `.reference-word`, and `.reference-word-meaning` elements.

- [ ] **Step 1: Write failing layout structure tests**

```tsx
expect(screen.getByLabelText('当前视力级别 4.6')).toHaveClass('optotype-level')
expect(screen.getByText('sky')).toHaveClass('reference-word')
expect(screen.getByText('天空')).toHaveClass('reference-word-meaning')
```

Assert that disabling reference words hides both English and Chinese but keeps the level label.

- [ ] **Step 2: Run the app test and verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/App.test.tsx`

Expected: FAIL because the level remains in the top metadata and no Chinese meaning exists.

- [ ] **Step 3: Implement semantic structure and CSS**

```tsx
<span aria-label={`当前视力级别 ${state.level.toFixed(1)}`} className="optotype-level">
  {state.level.toFixed(1)}
</span>
<div className="reference-word-group">
  <span className="reference-word">{referenceWord.en}</span>
  <span className="reference-word-meaning">{referenceWord.zh}</span>
</div>
```

Place `.optotype-level` at the far left aligned with the optotype center, use `font-size: 11px` and `opacity: .45`, and give `.reference-word-group` a top margin of `2lh` relative to its text flow.

- [ ] **Step 4: Run app tests and verify GREEN**

Run: `node node_modules/vitest/vitest.mjs run src/App.test.tsx src/App.voiceFallback.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit Task 4 files**

```bash
git add src/App.tsx src/styles.css src/App.test.tsx
git commit -m "feat: annotate optotypes with level and translation"
```

### Task 5: Full Verification and Local Acceptance Build

**Files:**
- Generated: `dist/**`
- Do not update: `edgeone-upload/**` until the user accepts the local result.

**Interfaces:**
- Consumes all prior tasks.
- Produces a local preview at `http://127.0.0.1:4174/` with production assets and EdgeOne-equivalent isolation headers.

- [ ] **Step 1: Run the complete verification suite**

Run: `node node_modules/vitest/vitest.mjs run`

Run: `node node_modules/eslint/bin/eslint.js .`

Run: `node node_modules/typescript/bin/tsc -b --pretty false`

Expected: all commands exit 0 with no unhandled errors.

- [ ] **Step 2: Build and verify EdgeOne-compatible assets**

Run: `node node_modules/vite/bin/vite.js build && node scripts/vosk-model-parts.mjs && node scripts/prepare-edgeone-build.mjs && node scripts/verify-edgeone-build.mjs`

Expected: 71 files, three model parts below the direct-upload limit, and SHA-256 `f7ae9a233b7e503d6807020f4ea81cb2f578d61e8d0b46a3a2bcc0a99e4f53bf`.

- [ ] **Step 3: Restart local production preview and open Chrome**

Run: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174`

Expected: local URL responds with COOP/COEP headers and the new hashed app assets.

- [ ] **Step 4: User acceptance checkpoint**

Verify with a real microphone: prompt audio cannot advance a page; every successful command shows confirmation; missed commands recover; bilingual words and the left-side level remain legible at two metres.

- [ ] **Step 5: Prepare upload only after acceptance**

Run after user approval: `rsync -a --delete --exclude _headers dist/ edgeone-upload/`

Expected: upload directory matches the accepted local build.
