// The only Three.js pieces the game uses, exposed as window.THREE for the realistic golfer (360-golfer3d.js).
// Bundled by build.mjs into its own <script> before the game script, so the round-checking worker never sees it.
import { WebGLRenderer, Scene, Camera, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry, BoxGeometry,
  DirectionalLight, HemisphereLight, Color, Matrix4, Vector3, Quaternion, Euler, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

window.THREE = { WebGLRenderer, Scene, Camera, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry, BoxGeometry,
  DirectionalLight, HemisphereLight, Color, Matrix4, Vector3, Quaternion, Euler, SRGBColorSpace, GLTFLoader };
