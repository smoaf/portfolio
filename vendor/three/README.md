# three.js 0.160.0 (self-hosted)

Copied unchanged from the npm package `three@0.160.0` (https://github.com/mrdoob/three.js, MIT licence in `LICENSE`).
Only `build/three.module.js` and the addon files the site imports, plus the files they import themselves:

- controls/OrbitControls.js
- environments/RoomEnvironment.js
- geometries/RoundedBoxGeometry.js
- loaders/GLTFLoader.js, loaders/STLLoader.js
- math/SimplexNoise.js (used by GTAOPass)
- postprocessing/EffectComposer.js, GTAOPass.js, MaskPass.js, OutputPass.js, Pass.js, RenderPass.js, ShaderPass.js
- shaders/CopyShader.js, GTAOShader.js, OutputShader.js, PoissonDenoiseShader.js
- utils/BufferGeometryUtils.js

To use another addon: copy it from the same package version into `examples/jsm/` at the same path, with every file it imports.
