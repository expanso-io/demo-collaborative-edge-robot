import { copyFile, mkdir } from 'node:fs/promises';

const root = new URL('./', import.meta.url);

await mkdir(new URL('vendor/', root), { recursive: true });

await copyFile(new URL('node_modules/@tensorflow/tfjs/dist/tf.min.js', root), new URL('vendor/tf.min.js', root));

await copyFile(new URL('node_modules/@tensorflow-models/speech-commands/dist/speech-commands.min.js', root), new URL('vendor/speech-commands.min.js', root));

console.log('Offline microphone libraries installed.');
