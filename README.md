# ESPLAB

An interactive ESP32 learning lab built with React, TypeScript, Three.js, and Sites/Vinext.

## Multi-board workspace and test lab

System canvas supports up to eight independent boards (up to twelve devices per board), movable/lockable cards, colors, naming, duplication, pan/zoom, grid snap, and validated workspace JSON save/import/export. Open a board's 3D workbench to edit its own circuit and code. Workbench changes synchronize to that board while this session remains open; Save explicitly persists the complete workspace. Arrange devices enables snapped 3D dragging; device positions survive circuit and workspace exports. Board geometry remains illustrative.

Directed UART links let you select TX/RX, configure baud at both ends, share ground, disconnect cables, corrupt bytes, and inspect decoded payloads and wire airtime. Tests reject occupied/reserved pins, missing ground, baud mismatch, shared receivers and CRC errors. Link delivery does not run a device command automatically. Step/run all advances automation per board; full concurrent firmware execution is not implemented.

Test lab provides real microphone recording, live waveform/RMS monitoring, playback, 16 kHz mono WAV export, editable transcripts and reviewed virtual-device commands. Local Whisper tiny runs in a dedicated browser worker via pinned Transformers.js 3.8.1 and a pinned Hugging Face model revision. First use downloads runtime/model assets from jsDelivr and Hugging Face (roughly 100 MB); audio is not uploaded for local inference. Browser recognition is an optional alternative that may use the browser vendor's online service. English, Hindi and Spanish transcription are offered; the bounded device-command grammar is English only. No API key is needed for either integration. Local processing can be slow on low-memory devices. The mic requires HTTPS/localhost and user permission. Recording is capped at 60 seconds; imported audio at 15 MB / 60 seconds.

Advanced controls cover gain, silence threshold, noise suppression, echo cancellation, recording length and microphone selection (labels become available after permission). The energy threshold is not an ESP WakeNet/VAD implementation. Circuit checks validate wiring, code syntax, one isolated teaching-interpreter loop and import compatibility; results can be exported. Microphone/WebGL interaction requires a connected browser and has not been interaction-tested by the agent in this environment. Deterministic tests cover workspace isolation, pin/link faults, layout serialization, command rejection and PCM/WAV encoding.

## Story playback and real-world scenarios

Pipeline & video captures current circuit state and the last 30 changes. Play, pause, seek and step through an animated DOM story. Playback does not need canvas recording support. Export video records a silent canvas WebM where supported; JSON explanations remain downloadable. Timing is slowed for learning.

Real-world scenarios explains device behavior from actual connections, values and estimated power/memory usage. Inject missing ground, weak power wiring, oversized display buffers or slow I2C edges, inspect consequences, then restore the original circuit. Predictions are educational, not physical measurements or damage certification.

## Private admin projects

Public catalogs contain only generic learning projects. Private architecture, templates, firmware sources and downloads are served exclusively by `/api/admin/content` after a server-verified admin session. No private content is shipped in public JavaScript or static assets. Authentication fails closed when configuration or private content is absent.

Owner deployment uses an encrypted server-only vault generated from ignored `.private` inputs with `node scripts/build-private-vault.mjs`. This generates a random 192-bit admin password, HMAC session key and AES-256-GCM content key. Credentials are written to `.private/admin-login.txt`; keys go to ignored `.dev.vars` for local use and must be configured as production secrets. Cookies are HttpOnly, SameSite=Strict, Secure on HTTPS, with eight-hour expiry. Login has a best-effort per-worker rate limit. Rotate the session key to invalidate all sessions. Private content responses are never cacheable.

The public source export intentionally includes an empty vault and no credentials. Admin access cannot reveal private projects in that distribution. Supply your own private content and credentials only if deploying an owner edition. Files an authorized admin downloads are ordinary personal copies; logout cannot erase those copies.

### Publishing source on GitHub

Run `python scripts/export-public.py` to create `.release/esplab-public-source.zip`. It copies an explicit public file allowlist, substitutes an empty private vault, removes deployment identity, and excludes all secrets, private inputs, build output and Git history. Start a **new repository** from this export. This development repository has private material in its earlier history, so do not push or mirror its history publicly. Choose a license before releasing your repository.

## Run

```sh
npm install
npm run dev
```

Open the Local URL printed by the development server. Run `npm run build` for production and `npm test` for simulation checks.

## Included

- Fourteen ESP32 family profiles with specifications, specialties, limitations, and official sources.
- A procedural 3D learning carrier with orbit/zoom/top view, clickable pins, exploded components, and virtual wiring.
- 48 device models, manual and automatic wiring, conflict validation, controls, and conceptual signal visualization.
- SRAM/ROM/flash/PSRAM/RTC memory explanations and interactive allocation/OTA budgets.
- Twelve lessons with quizzes and browser-local progress, a comparison table, and a searchable glossary.
- Browser-local circuit save/load, validated JSON import/export, and an ESP-IDF C starter export.

## Scope and accuracy

This is an educational behavioral simulator, not an ESP32 CPU emulator, SPICE solver, firmware compiler, RF simulator, or physical board CAD library. GPIO positions on the 3D model are illustrative. The catalog distinguishes chip capabilities from module capacities and actual board pinouts.

H21 and H4 use abstract IO terminals. E22 is a host connectivity reference without general GPIO simulation. Other families expose documented learning subsets; not every package SKU or third-party board is reproduced. Primary source links and notes are in `lib/hardware.ts` and the in-app Reference. Data checked 2026-09-09; new/preliminary family specifications may change.

The circuit engine supports up to twelve components. Virtual breakouts include support circuitry described in the UI. Memory figures are illustrative allocations and not measured free heap. The code export implements a simple LED blink and includes explicit TODOs for other peripheral drivers.

## Architecture

- `lib/hardware.ts`: family specifications and signal profiles.
- `lib/simulation.ts`: devices, pin compatibility, auto-wire, validation, memory budgets, and C generation.
- `components/board-scene.tsx`: interactive WebGL scene with a non-WebGL UI fallback.
- `components/learning-panels.tsx`: comparison, lessons, reference, and memory tools.
- `app/page.tsx`: workbench state, wiring interactions, simulation, and portable circuits.
- `tests/simulation.test.ts`: meaningful circuit and memory scenarios.

Browser interaction and visual QA require a connected browser. Type checks, build validation, and simulation tests can run without one.


## Expanded lab

The public Templates view contains 21 learning projects across sensing, automation, displays, audio, motor control and debugging challenges. Each includes circuit setup, adjustable parameters and a guide.

The Parameters view includes 31 shared controls and derived power, bus, CPU, frame, audio and memory estimates. Each device has specialized controls, with 203 device-parameter controls across the catalog, plus primary input/output values. The Automation editor supports threshold comparisons and range mapping, with one enabled rule per target. Inputs are sampled from the previous simulation tick. Version 2 JSON exports preserve devices, wires, parameters, rules and template selection; version 1 circuits remain importable.

## Assistant

The offline command helper works without credentials: `load greenhouse`, `add servo`, `set servo 120`, `set fan rpm 3000`, `set sampleRate 48000`, `auto-wire`, `run`, and `diagnose`. It is explicitly labeled offline and is not a language model.

Live AI now uses Ollama. OpenAI API calls have been removed. Local inference runs through a loopback-only bridge on this computer; the hosted site never tries to contact its own localhost as if it were the user's machine.

### Start local AI

1. Run Ollama and finish `ollama pull qwen3:4b` (about 2.5 GB). The existing Qwen3 14B failed GPU/host memory allocation on this laptop during setup.
2. In this project, run `npm run ollama:bridge`, or run `scripts/start-ollama-bridge.ps1` to start it in the background.
3. Open the assistant and choose Connect local Ollama. Allow local-network access if the browser requests it. The computer and bridge must remain running. If browser security blocks hosted-to-loopback requests, run `npm run dev` and use the printed localhost URL.

The bridge binds to 127.0.0.1 only, validates the Host and exact Origin, serves only status/chat endpoints, accepts installed model names, bounds request sizes and concurrency, and cancels inference on timeout/disconnection. No filesystem access or shell execution is exposed. Do not widen its Origin list to `*` or bind it to all interfaces.

### Optional Ollama Cloud

Run `ollama signin` yourself, then pull a cloud model available to your account, such as `ollama pull gpt-oss:120b-cloud`. Reconnect in the chat to refresh models. Cloud models require explicit enabling in the UI. Free accounts have limited starter credits and model access; no claim of unlimited free cloud inference is made. No subscription or credits are purchased automatically. Cloud JSON is prompted and validated because Ollama Cloud does not currently support structured-output schemas. For an optional server-hosted cloud connection, configure `OLLAMA_API_KEY` as a Sites secret and `OLLAMA_MODEL` as its model identifier. This also uses the Ollama account allowance. The default site has no cloud key.

### ChatGPT / Codex handoff

Copy circuit context from the assistant, paste it into your existing conversation, and paste the JSON reply into Import plan. Imported actions are validated and reviewed before application, with undo. This is an explicit manual handoff, not a live bridge into ChatGPT or a way to use a subscription as API credits.

## Code studio

Editable Arduino-style teaching programs drive the virtual circuit. Load one of four examples with its matching circuit, check syntax, run/pause, step a loop, inspect variables, and view the bounded serial monitor. Program source is preserved in circuit JSON. Code execution replaces automation rules while running.

A small parser/interpreter handles setup/loop, variables, assignments, if/else, arithmetic, device reads/writes, basic GPIO calls, virtual time, serial output and mapping helpers. It never uses eval or executes JavaScript. Source, tokens, nesting, instructions, strings and log lengths are bounded. State changes are atomic. `delay()` sets the next loop interval; it does not suspend a sequence midway through a loop. ADC readings are an ideal normalized mapping. Digital reads expose logical device state, not active-low electrical polarity. External libraries, arrays, interrupts, while/for and full Arduino/ESP-IDF compilation are not implemented. A separate ESP-IDF C wiring export remains available.

Verification: `npm test`, `npx tsc --noEmit`, `npm run build`. Tests include project wiring, automation, interpreter behavior, rollback, GPIO constraints, serialization, and assistant plan validation.

References: https://docs.ollama.com/cloud, https://docs.ollama.com/api/chat, https://docs.ollama.com/capabilities/structured-outputs, https://ollama.com/pricing.

Integration verification: signed-in `gpt-oss:120b-cloud` answered an ESP32 memory question and produced a validated greenhouse template action. Browser-to-loopback CORS preflight succeeded; a foreign Origin was rejected. Cloud availability depends on the account and its remaining allowance.
Code generation was verified end to end: Ollama returned a set_code plan, the source compiled in the teaching interpreter, a 35 C input drove the fan to 80%, and the serial monitor received 35. Invalid model output gets at most one corrective retry before being rejected.
