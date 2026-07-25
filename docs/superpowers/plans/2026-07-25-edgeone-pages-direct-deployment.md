# EdgeOne Pages Direct Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the current Red House Vision workspace into EdgeOne-compatible static assets, preserve offline Vosk voice through sub-25 MB model parts, and publish verified preview and production deployments.

**Architecture:** Keep the original Vosk tar outside Vite's public directory, then append deterministic model parts and an integrity manifest to `dist` after Vite builds. The browser resolves an embedded model first for the standalone HTML build, otherwise fetches the manifest and parts, verifies their byte lengths and SHA-256, and gives Vosk a temporary Blob URL. EdgeOne receives a direct upload containing only static assets plus `edgeone.json` security headers.

**Tech Stack:** Node.js 22, pnpm 11, Vite 8, React 19, TypeScript 5.9, Vitest 4, Node test runner, EdgeOne Makers CLI

## Global Constraints

- EdgeOne free edition maximum file size is 25 MB; every uploaded file must remain below 25,000,000 bytes.
- The complete Vosk model SHA-256 must remain `f7ae9a233b7e503d6807020f4ea81cb2f578d61e8d0b46a3a2bcc0a99e4f53bf`.
- Preserve same-origin model delivery, HTTPS, COOP `same-origin`, COEP `require-corp`, and microphone permission for `self`.
- Do not commit, overwrite, or stage unrelated pre-existing workspace changes.
- Do not save, print, or commit EdgeOne account tokens.
- Publish preview first; publish the identical verified `dist` to production only after preview acceptance.
- The application has no client URL routes; do not add an unsupported EdgeOne SPA wildcard rewrite.

---

## File Map

- Create `scripts/vosk-model-parts.mjs`: deterministic model splitting, manifest creation, and build-output validation helpers.
- Create `scripts/vosk-model-parts.test.mjs`: small-fixture Node tests for split order, size limits, hash, and corrupt checksum rejection.
- Move `public/models/vosk-model-small-cn-0.22.tar` to `models/vosk-model-small-cn-0.22.tar`: keep the source model out of Vite's copied public assets.
- Move `public/models/vosk-model-small-cn-0.22.sha256` to `models/vosk-model-small-cn-0.22.sha256`: colocate source integrity metadata.
- Modify `scripts/build-single-html.mjs`: read the relocated source model without changing standalone output behavior.
- Modify `scripts/start-windows.ps1`: validate the relocated source model used by the standalone workflow.
- Modify `public/models/README.md`: document the source and deploy-output locations.
- Modify `package.json`: run model-part tests and append parts to the production build.
- Modify `src/voice/embeddedModel.ts`: resolve embedded Base64 or verified multipart network models to one Blob URL.
- Modify `src/voice/embeddedModel.test.ts`: cover multipart success, caching, corrupt manifests, failed fetches, and URL cleanup.
- Modify `src/voice/voice.ts`: use the multipart manifest as the normal hosted Vosk path.
- Modify `src/voice/voice.test.ts`: assert the new default hosted path while preserving explicit overrides.
- Create `public/edgeone.json`: ship supported EdgeOne headers and cache policy with the direct-upload root.
- Create `scripts/verify-edgeone-build.mjs`: reject oversized files, raw model tar leakage, missing entry/config, or incorrect EdgeOne headers.
- Create `scripts/verify-edgeone-build.test.mjs`: exercise valid and invalid synthetic build directories.

### Task 1: Deterministic Vosk Model Build Parts

**Files:**
- Create: `scripts/vosk-model-parts.mjs`
- Create: `scripts/vosk-model-parts.test.mjs`
- Move: `public/models/vosk-model-small-cn-0.22.tar` → `models/vosk-model-small-cn-0.22.tar`
- Move: `public/models/vosk-model-small-cn-0.22.sha256` → `models/vosk-model-small-cn-0.22.sha256`
- Modify: `scripts/build-single-html.mjs:14`
- Modify: `scripts/start-windows.ps1:42`
- Modify: `public/models/README.md:1-18`
- Modify: `package.json:8-17`

**Interfaces:**
- Produces: `splitVoskModel({ sourcePath, checksumPath, outputDirectory, partSizeBytes }): Promise<VoskPartsManifest>`.
- Produces: `VoskPartsManifest` JSON with `{ version, byteLength, sha256, parts: Array<{ path, byteLength }> }`.
- Produces: `dist/models/vosk-model-small-cn-0.22.manifest.json` and numbered `.part` files.
- Consumes: the committed source tar and checksum under `models/`.

- [ ] **Step 1: Write failing splitter tests**

Create `scripts/vosk-model-parts.test.mjs` with `node:test`, temporary directories, and deterministic bytes:

```js
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createHash } from 'node:crypto'

import { splitVoskModel } from './vosk-model-parts.mjs'

test('writes ordered parts below the limit and a verifiable manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vosk-parts-'))
  const source = join(root, 'model.tar')
  const checksum = join(root, 'model.sha256')
  const output = join(root, 'dist', 'models')
  const bytes = Buffer.from('abcdefghijkl')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(source, bytes)
  await writeFile(checksum, `${sha256}  model.tar\n`)

  const manifest = await splitVoskModel({
    sourcePath: source,
    checksumPath: checksum,
    outputDirectory: output,
    partSizeBytes: 5,
  })

  assert.deepEqual(manifest.parts.map((part) => part.byteLength), [5, 5, 2])
  const rebuilt = Buffer.concat(await Promise.all(
    manifest.parts.map((part) => readFile(join(output, part.path))),
  ))
  assert.deepEqual(rebuilt, bytes)
  assert.equal(manifest.sha256, sha256)
})

test('rejects a source whose checksum does not match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vosk-bad-checksum-'))
  const source = join(root, 'model.tar')
  const checksum = join(root, 'model.sha256')
  await writeFile(source, Buffer.from('model bytes'))
  await writeFile(checksum, `${'0'.repeat(64)}  model.tar\n`)

  await assert.rejects(() => splitVoskModel({
    sourcePath: source,
    checksumPath: checksum,
    outputDirectory: join(root, 'dist', 'models'),
    partSizeBytes: 5,
  }), /checksum mismatch/i)
})
```

- [ ] **Step 2: Run the splitter test and confirm RED**

Run: `node --test scripts/vosk-model-parts.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/vosk-model-parts.mjs`.

- [ ] **Step 3: Implement the splitter**

Create `scripts/vosk-model-parts.mjs` with constants:

```js
export const EDGEONE_MAX_FILE_BYTES = 25_000_000
export const DEFAULT_PART_SIZE_BYTES = 20 * 1024 * 1024
export const MODEL_VERSION = 'vosk-model-small-cn-0.22'
```

Implement `splitVoskModel` to read and validate the checksum, remove only prior files prefixed with `${MODEL_VERSION}.part-`, write numbered files such as `vosk-model-small-cn-0.22.part-01`, assert each is below `EDGEONE_MAX_FILE_BYTES`, and write `vosk-model-small-cn-0.22.manifest.json`. Use relative filenames in `parts[].path`; do not include absolute local paths.

Add a direct-execution entry point that writes into `dist/models` when invoked as:

```bash
node scripts/vosk-model-parts.mjs
```

- [ ] **Step 4: Relocate the source model and update standalone consumers**

Use `git mv` for the tar and checksum. Change both `modelPath` in `scripts/build-single-html.mjs` and `$voskModel` in `scripts/start-windows.ps1` from `public/models` to `models`. Update `public/models/README.md` to state that the canonical source lives in `models/` and hosted parts are generated into `dist/models/`.

- [ ] **Step 5: Wire build and tests**

Change scripts in `package.json` to include:

```json
{
  "build": "tsc -b && vite build && node scripts/vosk-model-parts.mjs && node scripts/verify-edgeone-build.mjs",
  "test:model-parts": "node --test scripts/vosk-model-parts.test.mjs"
}
```

The verifier is introduced in Task 3; until then, exercise the splitter directly rather than the full `build` script.

- [ ] **Step 6: Run the splitter tests and real model generation**

Run: `node --test scripts/vosk-model-parts.test.mjs`

Expected: PASS for ordered reconstruction and checksum rejection.

Run: `pnpm exec vite build && node scripts/vosk-model-parts.mjs`

Expected: manifest plus three or fewer parts under `dist/models`; no part is 25,000,000 bytes or larger.

- [ ] **Step 7: Verify the standalone build still works**

Run: `pnpm build:single`

Expected: `red-house-vision.html` is recreated and reports the unchanged SHA-256.

- [ ] **Step 8: Commit only Task 1 files**

```bash
git add scripts/vosk-model-parts.mjs scripts/vosk-model-parts.test.mjs models/vosk-model-small-cn-0.22.tar models/vosk-model-small-cn-0.22.sha256 scripts/build-single-html.mjs scripts/start-windows.ps1 public/models/README.md package.json public/models/vosk-model-small-cn-0.22.tar public/models/vosk-model-small-cn-0.22.sha256
git commit -m "build: split Vosk model for EdgeOne"
```

### Task 2: Verified Multipart Browser Loader

**Files:**
- Modify: `src/voice/embeddedModel.ts`
- Modify: `src/voice/embeddedModel.test.ts`
- Modify: `src/voice/voice.ts:15`
- Modify: `src/voice/voice.test.ts:70-90`

**Interfaces:**
- Consumes: `VoskPartsManifest` JSON generated by Task 1.
- Produces: `resolveEmbeddedVoskModelPath(defaultPath: string): Promise<string>` with unchanged public signature.
- Produces: a cached `blob:` URL containing the verified complete tar, or the original path when it is not a manifest URL.

- [ ] **Step 1: Add failing multipart loader tests**

Extend `src/voice/embeddedModel.test.ts` with a manifest fixture:

```ts
it('downloads, verifies, combines, and caches multipart models', async () => {
  const bytes = new TextEncoder().encode('hello world')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('.manifest.json')) {
      return new Response(JSON.stringify({
        version: 'test-model', byteLength: 11, sha256,
        parts: [
          { path: 'test.part-01', byteLength: 6 },
          { path: 'test.part-02', byteLength: 5 },
        ],
      }))
    }
    return new Response(url.endsWith('01') ? bytes.slice(0, 6) : bytes.slice(6))
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:multipart-vosk')

  await expect(resolveEmbeddedVoskModelPath('/models/test.manifest.json'))
    .resolves.toBe('blob:multipart-vosk')
  await expect(resolveEmbeddedVoskModelPath('/models/test.manifest.json'))
    .resolves.toBe('blob:multipart-vosk')
  expect(fetchMock).toHaveBeenCalledTimes(3)
})
```

Add explicit tests that a non-OK response, a part length mismatch, a full SHA mismatch, and an invalid `parts` array reject. Preserve all embedded Base64 tests.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `pnpm exec vitest run src/voice/embeddedModel.test.ts src/voice/voice.test.ts`

Expected: FAIL because manifest paths are returned unchanged and no fetch occurs.

- [ ] **Step 3: Implement manifest validation and assembly**

In `src/voice/embeddedModel.ts`, add internal types and helpers:

```ts
interface VoskModelPart { path: string; byteLength: number }
interface VoskModelManifest {
  version: string
  byteLength: number
  sha256: string
  parts: VoskModelPart[]
}

function isManifestPath(path: string): boolean
function validateManifest(value: unknown): VoskModelManifest
async function resolveMultipartModel(manifestPath: string): Promise<string>
```

Resolve each part with `new URL(part.path, manifestResponse.url || new URL(manifestPath, location.href))`, fetch parts concurrently, enforce `response.ok`, compare every byte length and total length, digest the rebuilt bytes with `crypto.subtle.digest('SHA-256', bytes)`, and compare lowercase hex with the manifest. Use `application/x-tar` for the Blob. Cache and revoke the URL through the existing `cachedObjectUrl` and `pagehide` behavior.

Wrap the full manifest operation in a 60-second timeout and reject with `DOMException('Vosk model parts timed out', 'TimeoutError')`. Do not silently return the manifest URL after multipart validation begins; rejection must reach the existing voice fallback logic.

- [ ] **Step 4: Change only the hosted default path**

In `src/voice/voice.ts` set:

```ts
const DEFAULT_VOSK_MODEL_PATH = '/models/vosk-model-small-cn-0.22.manifest.json'
```

Update the corresponding default-path assertion in `src/voice/voice.test.ts`. Explicit caller overrides such as `/models/cn.tar.gz` remain unchanged.

- [ ] **Step 5: Run focused and complete unit tests**

Run: `pnpm exec vitest run src/voice/embeddedModel.test.ts src/voice/voice.test.ts`

Expected: PASS.

Run: `pnpm test`

Expected: all existing and new Vitest tests pass.

- [ ] **Step 6: Commit only Task 2 files**

```bash
git add src/voice/embeddedModel.ts src/voice/embeddedModel.test.ts src/voice/voice.ts src/voice/voice.test.ts
git commit -m "feat: load verified multipart Vosk model"
```

### Task 3: EdgeOne Static Configuration and Build Gate

**Files:**
- Create: `public/edgeone.json`
- Create: `scripts/verify-edgeone-build.mjs`
- Create: `scripts/verify-edgeone-build.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: final `dist` from Vite plus Task 1 model parts.
- Produces: `verifyEdgeOneBuild(distDirectory): Promise<void>`.
- Produces: a direct-upload root accepted by EdgeOne with all files below 25,000,000 bytes.

- [ ] **Step 1: Write failing build-verifier tests**

Create `scripts/verify-edgeone-build.test.mjs` using temporary directories. Cover a valid tree containing `index.html`, correct `edgeone.json`, manifest and two parts; an oversized 25,000,000-byte file; a leaked `.tar`; a missing `index.html`; and a missing COEP header.

The primary assertion shape is:

```js
await assert.doesNotReject(() => verifyEdgeOneBuild(validDist))
await assert.rejects(() => verifyEdgeOneBuild(oversizedDist), /25,000,000/)
await assert.rejects(() => verifyEdgeOneBuild(rawTarDist), /raw Vosk tar/i)
await assert.rejects(() => verifyEdgeOneBuild(noCoepDist), /Cross-Origin-Embedder-Policy/)
```

- [ ] **Step 2: Run the verifier tests and confirm RED**

Run: `node --test scripts/verify-edgeone-build.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Add the EdgeOne configuration**

Create `public/edgeone.json` with no rewrites and these header groups:

```json
{
  "headers": [
    {
      "source": "/*",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "Permissions-Policy", "value": "camera=(), geolocation=(), microphone=(self)" }
      ]
    },
    {
      "source": "/models/*.part-*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/models/*.manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

Do not override EdgeOne's built-in hashed-asset caching and do not add a SPA rewrite.

- [ ] **Step 4: Implement the build verifier**

Implement `verifyEdgeOneBuild` to recursively enumerate files, reject any file with `size >= 25_000_000`, reject filenames ending in `.tar` under `dist/models`, parse `edgeone.json`, assert the five exact global header pairs, require `dist/index.html`, parse the model manifest, and assert every listed part exists with the declared byte length.

Its direct-execution entry point must verify `dist`, print a short success summary with file count and largest file, and set a nonzero exit code on failure.

- [ ] **Step 5: Run verifier tests and full production build**

Run: `node --test scripts/verify-edgeone-build.test.mjs`

Expected: PASS.

Run: `pnpm build`

Expected: TypeScript, Vite, splitter, and verifier all exit 0; summary reports no file at or above 25,000,000 bytes.

- [ ] **Step 6: Run all local quality gates**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm test`

Run: `pnpm test:model-parts`

Run: `node --test scripts/verify-edgeone-build.test.mjs`

Expected: every command exits 0.

- [ ] **Step 7: Commit only Task 3 files**

```bash
git add public/edgeone.json scripts/verify-edgeone-build.mjs scripts/verify-edgeone-build.test.mjs package.json
git commit -m "build: add EdgeOne deployment gate"
```

### Task 4: Publish and Verify the EdgeOne Preview

**Files:**
- Deploy artifact only: `dist/`
- No source file changes expected.

**Interfaces:**
- Consumes: the exact locally verified `dist` from Task 3.
- Produces: EdgeOne project `red-house-vision` and a preview URL.

- [ ] **Step 1: Record the artifact fingerprint without exposing secrets**

Run:

```bash
shasum -a 256 dist/index.html dist/models/vosk-model-small-cn-0.22.manifest.json
```

Keep the two hashes in the task log so production can be proven to use the same artifact.

- [ ] **Step 2: Install and authenticate the EdgeOne CLI interactively**

Run: `npm install -g edgeone`

Run: `edgeone -v`

Run: `edgeone login`

Choose the account site matching the user's registered EdgeOne account and complete the browser login. Run `edgeone whoami` only to confirm authentication; do not copy account identifiers or tokens into repository files.

- [ ] **Step 3: Create the direct-upload project and publish preview**

Run:

```bash
edgeone makers deploy ./dist -n red-house-vision -e preview
```

Expected: deployment succeeds and prints a preview URL. If the project already exists but is not a direct-upload project, stop and create a new direct-upload project named `red-house-vision-preview` rather than altering an unrelated project.

- [ ] **Step 4: Verify HTTP headers and model assets**

Read the returned preview origin into a shell variable, then make the requests:

```bash
read -r edgeone_preview_origin
curl -fsSI "$edgeone_preview_origin/"
curl -fsSI "$edgeone_preview_origin/models/vosk-model-small-cn-0.22.manifest.json"
curl -fsSI "$edgeone_preview_origin/models/vosk-model-small-cn-0.22.part-01"
```

Expected: all return 200; the root includes COOP `same-origin`, COEP `require-corp`, `nosniff`, `no-referrer`, and the microphone permissions policy; the part includes immutable browser caching.

- [ ] **Step 5: Perform browser preview acceptance**

Open the preview URL and verify:

1. Home page renders without console errors.
2. Microphone permission prompt appears after voice starts.
3. Manifest and every model part return 200 in Network tools.
4. One spoken direction is recognized.
5. Keyboard arrows and on-screen controls can still complete the flow.
6. A refresh keeps the site functional and reuses cached model parts.

If voice fails, retain the preview URL, capture the failing response/status and console error, and return to the relevant task. Do not publish production.

### Task 5: Publish the Identical Artifact to Production

**Files:**
- Deploy artifact only: the unchanged `dist/` accepted in Task 4.
- No source file changes expected.

**Interfaces:**
- Consumes: preview-accepted `dist` and its Task 4 SHA-256 fingerprints.
- Produces: stable EdgeOne production URL.

- [ ] **Step 1: Prove the artifact is unchanged**

Run the same `shasum -a 256` command from Task 4 and compare both hashes byte-for-byte with the preview fingerprints. If either differs, rebuild and repeat preview acceptance.

- [ ] **Step 2: Publish production**

Run:

```bash
edgeone makers deploy ./dist -n red-house-vision -e production
```

Expected: deployment succeeds and prints the stable production URL.

- [ ] **Step 3: Repeat production smoke checks**

Repeat the three `curl -fsSI` checks and the minimal browser checks for rendering, microphone permission, one voice direction, and keyboard fallback.

- [ ] **Step 4: Hand off deployment details**

Report the production URL, preview URL, EdgeOne project name, artifact hashes, tested browser, response-header result, voice result, and fallback result. State explicitly that custom domain binding and ICP filing remain outside this deployment.

## Final Verification Checklist

- [ ] No file in `dist` is 25,000,000 bytes or larger.
- [ ] The rebuilt model hash equals `f7ae9a233b7e503d6807020f4ea81cb2f578d61e8d0b46a3a2bcc0a99e4f53bf`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, Node splitter tests, build-verifier tests, `pnpm build`, and `pnpm build:single` pass.
- [ ] Preview returns all required response headers and model assets.
- [ ] Preview browser voice and fallback paths pass before production deployment.
- [ ] Production uses byte-identical `dist` and passes smoke checks.
