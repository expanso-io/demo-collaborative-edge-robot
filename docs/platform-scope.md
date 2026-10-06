# Platform scope

Stage 1 runs six Expanso Edge v2.1.21 nodes on one Mac. All HTTP event,
SSE, presenter and node API listeners bind to loopback. They are unauthenticated
local development endpoints, with no TLS claim. Do not expose them to a network.
The browser bus checks its allowed origin. Edge stores each run in a separate
private directory under `.runtime/runs`; coordination state is intentionally
in memory and resets on restart. No privileged service, container or cloud
credential is required. The camera and microphone use local browser APIs.

The public replay runs each complete pipeline with file input and output,
using the same event bus implementation as the presenter for its internal
publish branches. Camera and microphone fixtures begin at recognition results;
the separate vision and audio suites verify the recognizers. The coordinator
uses the same serial rules as the live stage. Its generated UUIDs and timestamps
are checked by schema; destination, phase, reason, command targets and actions
are exact. The existing live six-node suite covers go timing, stop priority,
uncertainty and arrival. File replay does not measure hardware motion.

Expanso Cloud is the intended lifecycle manager for a later hardware rollout.
The local replay is credential-free evidence of pipeline behavior, not evidence
of a Cloud deployment. Loopback routing must be replaced with authenticated,
encrypted transport and explicit node placement for a multi-machine deployment.

`hardware.md` remains a future buying guide. Its Raspberry Pi OS, RaspRover,
ESP32, ROS, CoDrone EDU, CoDrone EDU Plus, Crazyflie, AI-deck, GAP8, DORY,
OpenCV, Logitech Brio, Tello, RoboMaster and related SDK and firmware references
are research for future adapters, not implemented platform integrations.
The `future-hardware` declaration records this scope without claiming that
purchasing advice is a tested deployment. Hardware safety and commissioning
remain prerequisites for that later work.
