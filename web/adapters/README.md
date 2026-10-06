# Device adapters

`MapAdapter` implements `id`, `moveTo(station)`, `pause()`, `resume()`,
`hold()` and `onState(callback)`. The subscription returns an unsubscribe
function. Pause and hold retain the destination. `tick(seconds)` advances the
map implementation; the stage owns its animation clock.

`connectAdapter` listens only for addressed commands from `coordinator`.
It ignores repeated command IDs, forwards adapter state as envelopes, and limits
continuous position reports to four per second. Phase changes report immediately.
No recognition or coordination rules live here.

`RealRoverAdapter` and `RealDroneAdapter` are transport scaffolds. Supply
`send(id, action, station)` and `subscribe(id, callback)` to connect a local
hardware bridge. The bridge must translate stations into hardware coordinates,
implement physical safety interlocks, and provide actual normalized telemetry.
These classes contain no hardware driver. Subscribe callbacks use the envelope
body contract: `{phase, station, x, y}`.

To substitute hardware, construct the relevant adapter in `web/stage/map.js`,
subscribe its telemetry to the marker, and retain `connectAdapter`. Real adapters
use hardware telemetry instead of `tick`. Pipeline rules remain unchanged.
