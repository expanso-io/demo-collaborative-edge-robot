# Hardware for the physical stage

Prices and stock were checked on 6 October 2026 on the makers' own stores, in US dollars with US delivery. Stock shown on a store page is not reserved inventory, so check again before ordering.

## Recommendation

Buy the **Waveshare RaspRover PI4B AI Kit, Raspberry Pi included, no pan-tilt, US supply (SKU 26822)** for **$333.99**. It has a documented Python/serial JSON interface, wheel encoders, a Raspberry Pi that can host Expanso Edge, and enough hardware for a short indoor station-to-station demonstration. Start with two taped routes and station markers. Reliable arrival still requires localization and rehearsal; buying the chassis does not supply `moveTo(station)`.

For physical flight today, buy **two Robolink CoDrone EDUs at $249 each**. They have guards, a supported laptop Python API, short relative moves, hover, landing, and local position telemetry. **They do not provide a camera feed.** Keep recognition on the fixed ground camera and make the drones physical participants in the shared action. This is the easiest kit that can be ordered today, with that explicit camera limitation.

For programmable camera drones, the strongest documented candidates are **Bitcraze Crazyflie 2.1 Brushless + AI-deck 1.1** and **Crazyflie 2.1+ + AI-deck 1.1**. Both maker AI bundles are **out of stock today**, as is the standalone AI-deck. They are engineering platforms, not a fast substitute for CoDrone. The camera-enabled CoDrone EDU Plus is announced but has no published price or firm shipping date.

No researched kit satisfies the literal requirement that each tiny aircraft itself runs Expanso Edge. The practical arrangement is one dedicated logical Edge node/pipeline per aircraft on a nearby Mac or Linux companion, with the aircraft controlled over its local radio. Describe the host location honestly. The rover can carry its own Edge process. Do not claim the airborne devices run Edge until a suitable onboard Linux computer has actually been integrated and tested.

## Products, stock, and delivery

| Product and checked maker link | Price and availability observed | Shipping and contents |
| --- | --- | --- |
| [Waveshare RaspRover PI4B AI Kit, SKU 26822](https://www.waveshare.com/rasprover.htm?sku=26822), Pi included, no pan-tilt, US supply | **$333.99**, page structured data says `InStock`; selected attributes confirm the variant | Pi 4B 4GB, camera, TF card and cooling included. **Three 18650 cells are excluded.** Maker normally processes within 3 business days; UPS estimate 3–7 working days after dispatch. Its current holiday banner says shipments resume gradually from Oct 5, so do not promise an event delivery date. Freight/import charges additional. |
| [Waveshare RaspRover PI5 AI Kit, SKU 26834](https://www.waveshare.com/rasprover.htm?sku=26834), Pi included, no pan-tilt, US supply | **$379.99**, `InStock` | Same battery exclusion and shipping caveats. Pi 5 4GB and USB camera. Choose this $46 upgrade if rover-local vision needs more CPU; unnecessary for initial fixed-camera recognition on the Mac. |
| [Robolink CoDrone EDU](https://www.robolink.com/products/codrone-edu) | **$249.00**, maker product JSON `available:true` | One drone/controller, two flight batteries, dual charger, USB-A to micro-USB cable, spare props, color pads. Controller AA cells excluded. Published domestic policy: 1–3 business days processing, 3–5 business days delivery; it also mentions same/next-day dispatch cutoffs, so use the conservative range. No address-specific checkout quote obtained. |
| [Bitcraze AI bundle: Crazyflie 2.1 Brushless](https://store.bitcraze.io/products/the-ai-bundle-crazyflie-2-1-brushless) | **$830.00**, `available:false` | Aircraft, Flow deck v2, Crazyradio 2.0, AI-deck 1.1, Olimex programmer bundle. Restock date unverified. Ships from Sweden; usual fulfillment 2–3 business days when stocked; LiPo orders require FedEx. Destination ETA, freight and import costs unquoted. |
| [Bitcraze AI bundle: Crazyflie 2.1+](https://store.bitcraze.io/products/the-ai-bundle) | **$610.00**, `available:false` | Same supporting components with the lighter brushed aircraft. Restock date unverified. Same shipping policy. Prop guards are not listed in this bundle's contents; source compatible guards before stage use. |
| [Logitech Brio 300, Graphite](https://www.logitech.com/en-us/shop/p/brio-300-webcam) | **$59.99**, “In stock. Ready to ship” | USB-C, 1080p, light correction, privacy shutter; maker advertises free shipping in 3–5 business days. Clip to a stable stand/monitor pointed at the volunteer's card area. Stand not priced. |
| [Robolink CoDrone EDU Plus](https://www.robolink.com/pages/codrone-edu-plus) | **No final published price; not a confirmed buy-now product** | Maker says in production, shipping during the **2026–27 school year**, with updates for when preorders open. Camera announced; final SDK/video transport, weight and endurance not verified. Do not schedule a demo around it. |

Stock is website evidence, not reserved inventory. The maker's base RaspRover page shows a $174.99–$419.99 range: **$174.99 is not the price of the complete recommended rover**. Exact SKU selection matters.

## Capability and integration assessment

### RaspRover: recommended rover

The maker documents Raspberry Pi OS/Bookworm, Python/Flask, and an ESP32 subcontroller. It advertises ROS 2 Humble support, but the simplest adapter uses the documented serial JSON interface and avoids installing navigation infrastructure for a two-station stage. Source: [RaspRover wiki](https://www.waveshare.com/wiki/RaspRover), [chassis motion tutorial](https://www.waveshare.com/wiki/02_Python_Chassis_Motion_Control), [JSON commands](https://www.waveshare.com/wiki/08_Sub-controller_JSON_Command_Set).

The complete non-pan-tilt chassis is about **1.054 kg**, **172 × 183 × 132 mm**, with a specified maximum speed of **0.65 m/s**. This is a tabletop-size rover, but run it on the floor inside a bounded course, away from stage edges and feet. Proposed stage speed is at most 0.1–0.2 m/s after testing; the maker warns very low wheel speeds can fluctuate. Use a physical cutoff and a spotter. The enclosure and encoders are useful features, not evidence that this particular unit has passed a reliability test.

**Battery life:** three separately purchased 18650 cells feed the built-in 3S UPS. The consulted maker pages give no defensible runtime figure for this configuration. Do not substitute a generic “two hours” claim. Choose cells to the UPS's exact specifications, measure current and runtime with Edge running, and validate at least the full rehearsal plus reserve. The UPS supports charging while operating, but do not drive a tethered rover across the stage.

**Setup estimate:** half a day for assembly/power/network and bench motion, then roughly 2–4 engineering days for the adapter, route localization and repeatability tests. These are estimates, not measured work. Maker `app.py` starts automatically and owns both camera and serial port; disable that autostart intentionally before giving the adapter exclusive control. Avoid exposing the supplied Flask/Jupyter applications publicly.

**Adapter work:** Python `BaseController`, 115200 baud; `/dev/serial0` on Pi 4 and `/dev/ttyAMA0` on Pi 5 in the documented image. Command `{"T":1,"L":0,"R":0}` stops wheels; nonzero L/R values are meters per second. Configure the correct chassis at startup. Read `T:1001` feedback for wheel speed, IMU and voltage. The onboard heartbeat eventually stops stale commands, but the documented 2–4-second refresh guidance is too slow to treat as a stage safety reaction. Add and test a tighter local watchdog, command expiry, and a separate physical stop.

`moveTo(station)` must look up a calibrated route/pose, then close the loop using local sensing. Tape following plus station markers is sufficient for this stage; odometry alone drifts during skid turns. `pause()` sends zero speed and preserves target; `resume()` replans the remaining route from observed pose; `hold()` inhibits motion while uncertainty persists. `onState(cb)` publishes measured/estimated pose and actual motion state, never a timer-driven animation presented as telemetry. See [feedback documentation](https://www.waveshare.com/wiki/06_Retrieving_Chassis_Feedback_Information).

### CoDrone EDU: easiest physical flight, no video

**SDK:** official `codrone_edu` Python package, plus Blockly. The controller connects by USB to the laptop; the drone uses its own 2.4GHz radio. Pair each controller by explicit serial port and run a separate adapter worker per aircraft. Maker documents multi-drone support. Mac USB permissions, hub capacity and simultaneous command handling still need a bench test.

**Safety and endurance:** integrated prop guards; maker sources report roughly **55–57 g** (54.8 g in current indexed learning specifications, 57 g in its product-introduction article). **7–8 minutes** flight per battery and approximately **60 minutes** charging; two batteries included. Expect less usable stage time after reserve and maneuvering. Plan brief flights and land between scenes. The color/flow sensors are not an accessible video camera; do not promise image recognition from them. Sources: [maker design article](https://www.robolink.com/blogs/roblog-link/codrone-edu-and-what-makes-it-different), [battery page](https://www.robolink.com/products/battery-codrone-edu), [technical specification PDF](https://docs.robolink.com/assets/files/cde_technical_specifications_v_1_1-87fc0793f9205a596e820f78b19ca846.pdf). The 54.8 g figure came from the maker’s indexed learning-page snippet; the PDF flight-time specification was also found through search indexing, not a downloaded PDF inspection.

**Adapter:** [official function documentation](https://docs.robolink.com/docs/CoDroneEDU/Python/Function-Documentation/) provides `move_distance(x,y,z,velocity)`, `send_absolute_position(...)`, `hover()`, `land()`, `get_position_data()` and `get_movement_state()`. Position resets at takeoff or battery insertion. Establish the map transform from a marked launch pad every flight; these coordinates are not independent global localization. Well-lit, patterned flooring is required for best positioning performance.

Translate `moveTo(station)` to a surveyed short move at a fixed internal flight height. `pause()` means cancel travel and hover, **not** `emergency_stop()`: that API cuts motors and drops the aircraft. `resume()` computes remaining displacement from current telemetry. `hold()` stays grounded if not airborne; if airborne it hovers briefly then lands on a timeout or low battery. Use a preemptible command loop rather than a blocking long movement that queues stop behind go. Verify SDK interruption behavior on actual hardware.

**Setup estimate:** 1–2 hours for first manual/Python flight, 1–3 engineering days for a paired adapter and stop/interruption tests; allow additional rehearsal time for two aircraft and venue radio conditions. No metered service or cloud speech is needed.

### Crazyflie camera drones: a documented path, with stock and tooling problems

**Preferred camera platform:** Crazyflie 2.1 Brushless AI bundle at $830. Official specifications give **37 g with guards**, before adding decks, **10 minutes** stock-battery flight, **60-minute** charging, and up to **40 g** recommended payload. Included guards should be fitted. Source: [maker specifications](https://www.bitcraze.io/products/crazyflie-2-1-brushless/). The 10-minute figure is not a measured AI-deck flight duration.

**Lower-cost camera platform:** Crazyflie 2.1+ AI bundle at $610. Base aircraft is **29 g**, rated **7 minutes**, **40-minute** charging, **15 g** recommended payload. Added camera/Flow decks and guards reduce margin. Source: [maker specifications](https://www.bitcraze.io/products/crazyflie-2-1-plus/). This saves $220 per aircraft but is less forgiving of payload and battery wear.

Both have an open Python `cflib` client and editable C firmware, with ROS integrations available. The AI-deck has a **320 × 320 grayscale camera**, GAP8 processor and ESP32 Wi-Fi. The [official Wi-Fi streamer example](https://www.bitcraze.io/documentation/repository/aideck-gap8-examples/master/examples/wifi-streamer/) sends JPEG or raw images to an OpenCV host viewer. A small model can run on that local host without cloud inference, but **raw imagery then leaves the aircraft**. This cannot be presented as “only recognition results leave each physical device.” On-aircraft inference with small-result transmission requires embedded work.

The [AI-deck maker listing](https://store.bitcraze.io/products/ai-deck-1-1) explicitly warns that its upstream autotiler is unavailable, preventing normal neural-network deployment through `gap_sdk` or the supplied Docker image unless the required file is already available. DORY is listed as an alternative. A compatible JTAG programmer is required; the AI bundles include an Olimex bundle. This is a current tooling dependency failure, not an SDK firmware lock. Do not budget onboard inference as a quick installation.

**Availability cross-check:** standalone Brushless aircraft **$480, available**, Flow deck v2 **$55, available**, Crazyradio 2.0 **$43, available**, but AI-deck **$240, unavailable**. Buying parts does not bypass the camera shortage.

**Adapter:** `cflib` motion/position commands, telemetry logging callbacks, and radio URI per aircraft. Flow deck supports short relative flight over a textured, well-lit surface, but does not provide drift-free global station coordinates. See [MotionCommander tutorial](https://www.bitcraze.io/documentation/repository/crazyflie-lib-python/master/user-guides/sbs_motion_commander/). Use calibrated launch pads and bounded segments initially; precise repeated multi-drone station arrival needs external positioning, such as the ecosystem's Lighthouse system, with additional cost and setup. Keep `z`, yaw and flight safety internal to the drone adapter because the requested public state is only two-dimensional. Do not initialize a helper that auto-takes-off during UI startup.

**Setup estimate:** several days for flight, telemetry and camera stream integration; allow 1–2 weeks or more for reliable airborne inference/toolchain repair and event rehearsal. Both bundles remain conditional recommendations until stock and a reproducible build are confirmed.

### Fixed ground camera

Use the **existing Mac webcam at $0** first. The **$59.99 Brio 300** gives a stable, independently aimed USB-C camera without a network camera, battery management or cloud account. Recognition remains on the Mac through its local camera capture API or browser `getUserMedia`; Python/OpenCV or the existing local model can consume the frames. The webcam has no model SDK of its own and cannot run Edge. Treat camera plus Mac process as the ground-camera device.

USB power means no separate camera battery-life limit. Budget 30–60 minutes for positioning, permissions and card-framing tests, followed by confidence calibration under actual projector and stage lighting. Keep the camera frame local. Do not replace the narrow two-card classifier with tag detection alone while calling it number recognition; route markers can be separate from the volunteer's cards.

## Kit totals

These are equipment subtotals checked today, not delivered checkout totals. The Mac is assumed owned.

| Kit | Calculation | Product subtotal | Qualification |
| --- | --- | ---: | --- |
| **Recommended buy-now stage kit** | RaspRover Pi 4 $333.99 + 2 × CoDrone EDU $249 + Brio 300 $59.99 | **$891.98** | Two physical aircraft; all card recognition uses the fixed camera. No airborne video. |
| **Cheaper fallback** | Same rover $333.99 + 1 × CoDrone EDU $249 + existing webcam | **$582.99** | One physical aircraft; keep the second aircraft on the stage map. Saves $308.99. |
| Camera-capable research kit | Same rover $333.99 + 2 × Brushless AI bundle $830 + Brio $59.99 | **$2,053.98** | Not currently orderable as a complete kit; AI bundles out of stock. No external position system included. |
| Cheaper camera-capable research kit | Same rover $333.99 + 2 × 2.1+ AI bundle $610 + Brio $59.99 | **$1,613.98** | Also out of stock; add compatible prop guards and account for lower payload/endurance. |

For the buy-now kit, add a **planning allowance of $200**: approximately $30 for matched rover cells, $20 for AA cells/USB hub or adapters, and $150 for an appropriate small flight enclosure and floor markers. Those are estimates, not verified accessory quotes. That makes a **$1,091.98 pre-tax/pre-freight planning total**; fallback with the same allowance is **$782.99**. An enclosure appropriate to the actual venue may cost more. Camera-research configurations need separate allowance for guards, positioning, spares and shipping; do not represent their product subtotal as an all-in event budget.

The least expensive first physical milestone is the rover alone plus existing webcam/mic: **$333.99**, plus cells and shipping, with all aircraft still on the stage map. It already demonstrates camera + voice combining to move and stop a real robot.

## Preserve the pipeline rules and the physical truth

Keep `DeviceAdapter { id; moveTo(station); pause(); resume(); hold(); onState(cb) }` and `{phase, station, x, y}` unchanged. Put station definitions and frame calibration in adapter configuration. Store pending target separately from whether motion is permitted, so stop does not erase the destination. Pipeline coordination owns confidence, fresh go permission, and stop priority. Every adapter owns low-level feedback control, expiry and physical safety interlocks.

The interface needs a documented lifecycle convention for aircraft: initial `hold()` must never take off, `moveTo` only operates after explicit arming, and prolonged airborne hold lands safely. Manual arm/land/emergency controls belong to the adapter's operator boundary, not a browser bypass that writes raw motor commands. A hardware emergency stop is independent of ordinary voice commands.

Emit state from telemetry with a consistent calibrated map frame. Preserve `station` through pause, mark unavailable pose with an explicit phase/diagnostic rather than silently inventing coordinates, and distinguish target station from confirmed arrival. Test delayed and duplicate commands, out-of-order go after stop, stale recognition, disconnection, depleted battery, uncertain card and lost localization. Stop latency must be measured physically; a green animation is not proof.

The small recognition-event claim is supportable for Mac-local camera/mic models and rover-local models. A drone video stream to a companion must be disclosed and counted. The reveal should report measured event payload/transport bytes and label the raw-frame/audio baseline as a calculation. Do not claim network bytes saved from a camera that never generated a stream, or exclude drone Wi-Fi video from the system total.

Use Expanso Cloud for workload lifecycle and pipeline deployment; keep physical control and watchdogs local and the presenter UI localhost-only. A cloud connection must not sit in the motor safety loop. An Edge binary on the proposed Pi image, a deployment and the physical radio links are still to be verified on the hardware.

## Event safety and firmware purchasing traps

For a **wholly indoor US event**, the [FAA's specific indoor-commercial-flight FAQ](https://www.faa.gov/faq/do-faa-rules-and-regulations-apply-commercial-uas-or-drone-operations-conducted-indoors-only) says Part 107 does not apply indoors; FAA rules apply to operations outdoors in the NAS. This is not venue authorization. Obtain the venue's written agreement and satisfy its insurance, fire/LiPo and local requirements. A roofed area with open sides or flight through a door should not be assumed wholly indoors. Under-250-g weight does not generally exempt outdoor commercial work from Part 107/registration rules.

Use guards **and** an enclosed flight zone separated from volunteers. Keep flights low and short; one aircraft airborne at a time for the first stage version. Provide a trained operator with controller override and a spotter. Props above people, a drone flying toward a volunteer holding a card, and voice-only emergency control are excluded from this recommendation. Test projector interference, patterned flooring, HVAC drafts and radio congestion. Land for scene transitions and battery reserve. Keep the rover course outside the flight enclosure and away from stage edges.

**Tello/Tello EDU/RoboMaster TT:** attractive historically because of local UDP control and video, but not the procurement baseline. The maker's [Tello page](https://www.ryzerobotics.com/tello) still advertises camera and SDK, while a current [education reseller notice](https://shemaps.com/blog/programmable-drones-education-tello-or-tello-edu/) says Tello EDU is no longer commercially available after the education division closed. No current maker checkout price, stock, delivery date or supported replacement-battery supply was verified. Treat old listings as legacy/remaining stock, not proof of continuing manufacture. Check exact SKU, firmware, SDK version, app setup and return rights before any second-hand purchase. There is no authoritative evidence today that a named current Tello firmware universally removes SDK access; that claim is not established.

**RoboMaster S1:** do not buy a cheap used one expecting the EP SDK. [DJI's own support page](https://www.dji.com/global/support/product/robomaster-s1) says S1 only supports the official in-app programming platform. Search surfaced community warnings that newer firmware blocks an unofficial S1 SDK hack, but no precise supported firmware boundary was verified. The EP's official SDK support does not make S1 equivalent.

**CoDrone EDU Plus:** camera announcement does not establish a delivered SDK or camera stream. Revisit after price, shipping and local API documentation are public. **Crazyflie:** open firmware reduces vendor SDK-lock risk, but the current AI toolchain outage and unavailable deck are immediate practical blockers. Freeze and record a validated firmware/SDK combination for rehearsal; do not update it on event day.
