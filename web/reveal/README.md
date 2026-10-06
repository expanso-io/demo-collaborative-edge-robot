Import `mount` from `./reveal/index.js` and call `mount(element, bus)`.
The module loads its own scoped stylesheet. It opens no connections and posts
no events. Its return value has `destroy()` and `snapshot()` methods.

The shared bus delivers each envelope once through `on(kind, handler)`.
Returning an unsubscribe function is recommended; without one, destroy stops
updates but the bus retains the inactive listener until the bus is discarded.
The module trusts the integration contract's validated envelopes. It contains
no coordination rules and does not infer destinations or permission.

Accounting counts each delivered envelope, including repeated IDs, as compact
`JSON.stringify` UTF-8 bytes. It sums every `raw_bytes` value and keeps exact
integer totals with BigInt. The ratio is envelope bytes : raw bytes, unreduced.
Before events it reads 0:0, with an explicit waiting message. The transcript
retains 12 envelopes; totals retain the entire mounted session.

The fixed envelope schema has no original wire-length or hop field. Exact
payload accounting therefore requires compact JSON serialization and one bus
delivery per exchanged envelope. SSE framing, HTTP headers, and any duplicate
transport hops are excluded. Decisions remain at the coordinator; recognition
and state point toward it; commands use `body.target`. No contract change is
needed for the specified logical links. Physical transport accounting would
require wire-size and hop metadata from the bus block.

Camera and mic lines identify their narrow local models. Other devices identify
their pipeline or adapter roles without claiming additional models.

Light is the default. The host's `[data-theme="dark"]` or `.dark` ancestor selects
dark colors. The stage owns the remembered toggle; the standalone preview has
its own remembered toggle. Reduced-motion preference disables packet motion.

From the repository root, preview this block alone:

```sh
uv run --no-project python -m http.server 4186 \
  --bind 127.0.0.1
```

Open `http://127.0.0.1:4186/tests/reveal/`. Replay sends the fixture sequence
through a fake bus; it does not start devices or pipelines.

Run the block's unit tests and browser-code typecheck:

```sh
node --test tests/reveal/accounting.test.js
npm exec --package=typescript -- \
  tsc -p tests/reveal/tsconfig.json
```

Rendered assertions are exported by `tests/reveal/browser-check.js` as
`checkRendered()`. See `tests/reveal/proof.md` for the captured validation.
