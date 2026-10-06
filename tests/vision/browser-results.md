# Browser verification, 2026-10-06

An isolated agent-browser Chrome session opened the standalone preview on
127.0.0.1:4187. The session reported `browserLaunched: true`; no signed-in
browser profile was used.

`runBrowserCheck()` returned seven passing assertions:

- Camera requests no audio.
- A video frame produces one confident card envelope.
- Raw byte count uses the source frame dimensions.
- Stop releases the media tracks.
- Stop clears the preview pixels.
- Permission failure rejects and displays the cause.
- Stop during a pending permission request releases the late stream.

Card 1 scored 0.908 through the actual video/canvas/browser path. The stream
was a generated fixture supplied with `canvas.captureStream(4)`. This was
not a physical webcam or photographed card test.

Additional checks observed document scroll width equal to viewport width at
320, 400, 768, and 1440 px. Dark mode persisted after reload. Browser error
output was empty. Network requests were all to the local static server;
the optional favicon request returned 404. No image/audio upload occurred.

`browser-preview.png` shows the card outline in the live preview. The preview
uses a canvas rather than a second copy of the webcam image.

The named browser session was closed; its process was gone. The owned HTTP
server exited with Ctrl-C; port 4187 had no listener afterward. Port 4186 was
already occupied before this task and was not touched.

Remaining proof: real camera photographs at measured 1–3 m, venue lighting,
people and background clutter, and offline operation with actual permissions.
