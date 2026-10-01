// Xbot.glb -> assets/golfer.glb: no animations, simplified, quantized (plain glTF features GLTFLoader reads without extra decoders)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, weld, simplify, quantize, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [src, out, ratio = '0.45'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
// animations go with their samplers and channels, or their data stays in the file
for (const a of doc.getRoot().listAnimations()) { for (const x of [...a.listSamplers(), ...a.listChannels()]) x.dispose(); a.dispose() }
await MeshoptSimplifier.ready;
await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.002 }), prune(), quantize(), prune());
// animation data the steps above left behind: accessors nothing uses any more
for (const a of doc.getRoot().listAccessors()) if (a.listParents().every(p => p.propertyType === 'Root')) a.dispose();
await io.write(out, doc);
