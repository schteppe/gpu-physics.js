var numParticles = 64;
var numBodies = numParticles;
var gridResolution = new THREE.Vector3(numParticles/2, numParticles/8, numParticles/2);
var gridPosition = new THREE.Vector3(0.25,0.29,0.25);
var cellSize = new THREE.Vector3(1/numParticles,1/numParticles,1/numParticles);
var radius = cellSize.x * 0.5;
var gravity = new THREE.Vector3(0,-1,0);
var showDebugGrid = true;
var params1 = new THREE.Vector4(
  2000, // stiffness
  5, // damping
  radius, // radius
  0.5 // drag
);
var params2 = new THREE.Vector4(
  1/100, // time step
  5, // friction damping
  0, // unused
  0 // unused
);
var params3 = new THREE.Vector4(0.5,0.5,0.5,0.05);

var gridPotZ;
var container, controls;
var fullscreenQuadCamera, camera, fullscreenQuadScene, scene, renderer;
var particlePosTextureRead, particlePosTextureWrite, particleVelTextureRead, particleVelTextureWrite, gridTexture, particleForceTexture;
var material, fullScreenQuad, mesh;
var sceneMap;
var sceneMapParticlesToBodies;
var setGridStencilMaterial, setGridStencilMesh;
var texturedMaterial;
var mapParticleMaterial;
var updatePositionMaterial;
var updateVelocityMaterial;
var updateForceMaterial;
var updateTorqueMaterial;
var debugQuads = {};
var mapParticleToCellMesh;
var spheresMesh;
var sharedShaderCode;
var dataTex = {};
var debugGridMesh;
var updateQuaternionMaterial;
var localParticlePositionToWorldMaterial;
var addForceToBodyMaterial;
var updateBodyVelocityMaterial;
var gizmo;

init();
animate();

function getShader(id){
  var code = document.getElementById( id ).textContent;
  return sharedShaderCode + code;
}

function getDefines(){
  return {
    resolution: 'vec2( ' + numParticles.toFixed( 1 ) + ', ' + numParticles.toFixed( 1 ) + " )",
    gridResolution: 'vec3( ' + gridResolution.x.toFixed( 1 ) + ', ' + gridResolution.y.toFixed( 1 ) + ', ' + gridResolution.z.toFixed( 1 ) + " )",
    gridPotZ: 'int(' + gridPotZ + ')',
    bodyTextureResolution: 'vec2( ' + numBodies.toFixed( 1 ) + ', ' + numBodies.toFixed( 1 ) + " )",
  };
}

function init() {
  container = document.getElementById( 'container' );
  sharedShaderCode = document.getElementById( 'sharedShaderCode' ).textContent;

  // Compute upper closest power of 2 for the grid texture size in z
  var potSize = 1;
  while(potSize*potSize < gridResolution.z){
    potSize *= 2;
  }
  gridPotZ = potSize;

  // Set up renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( 1/*window.devicePixelRatio*/ ); // For some reason, device pixel ratio messes up the rendertargets on mobile
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.autoClear = false;
  container.appendChild( renderer.domElement );
  window.addEventListener( 'resize', onWindowResize, false );

  texturedMaterial = new THREE.ShaderMaterial({
    uniforms: { texture: { value: null } },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'testFrag' ),
    defines: getDefines()
  });

  // Fullscreen render pass helpers
  fullscreenQuadScene = new THREE.Scene();
  fullscreenQuadCamera = new THREE.Camera();
  fullscreenQuadCamera.position.z = 1;
  var plane = new THREE.PlaneBufferGeometry( 2, 2 );
  fullScreenQuad = new THREE.Mesh( plane, texturedMaterial );
  fullscreenQuadScene.add( fullScreenQuad );

  // Body textures: todo
  bodyPosTextureRead = createRenderTarget(numBodies, numBodies);
  bodyPosTextureWrite = createRenderTarget(numBodies, numBodies);
  bodyQuatTextureRead = createRenderTarget(numBodies, numBodies);
  bodyQuatTextureWrite = createRenderTarget(numBodies, numBodies);
  bodyVelTextureRead = createRenderTarget(numBodies, numBodies);
  bodyVelTextureWrite = createRenderTarget(numBodies, numBodies);
  bodyAngularVelTextureRead = createRenderTarget(numBodies, numBodies);
  bodyAngularVelTextureWrite = createRenderTarget(numBodies, numBodies);
  bodyForceTexture = createRenderTarget(numBodies, numBodies);
  bodyTorqueTexture = createRenderTarget(numBodies, numBodies);

  // Particle textures
  particlePosLocalTexture = createRenderTarget(numParticles, numParticles);
  particlePosRelativeTexture = createRenderTarget(numParticles, numParticles);
  particlePosWorldTexture = createRenderTarget(numParticles, numParticles);
  particlePosTextureRead = createRenderTarget(numParticles, numParticles);
  particlePosTextureWrite = createRenderTarget(numParticles, numParticles);
  particleQuatTextureRead = createRenderTarget(numParticles, numParticles);
  particleQuatTextureWrite = createRenderTarget(numParticles, numParticles);
  particleVelTextureRead = createRenderTarget(numParticles, numParticles);
  particleVelTextureWrite = createRenderTarget(numParticles, numParticles);
  particleAngularVelTextureRead = createRenderTarget(numParticles, numParticles);
  particleAngularVelTextureWrite = createRenderTarget(numParticles, numParticles);
  particleForceTexture = createRenderTarget(numParticles, numParticles);
  particleTorqueTexture = createRenderTarget(numParticles, numParticles);

  // Broadphase
  gridTexture = createRenderTarget(2*gridResolution.x*potSize, 2*gridResolution.y*potSize);

  console.log((numParticles*numParticles) + ' particles');
  console.log((numBodies*numBodies) + ' bodies');
  console.log('Grid texture is ' + (2*gridResolution.x*potSize) + 'x' + (2*gridResolution.y*potSize));

  // Initial state
  fillRenderTarget(particlePosTextureRead, function(out, x, y){
    out.set( 0.35 + 0.3*Math.random(), 0.1*Math.random() + 0.3, 0.35 + 0.3*Math.random(), 1 );
  });
  fillRenderTarget(bodyPosTextureRead, function(out, x, y){
    out.set( 0.35 + 0.3*Math.random(), 0.1*Math.random() + 0.3, 0.35 + 0.3*Math.random(), 1 );
  });
  fillRenderTarget(particleVelTextureRead, function(out, x, y){
    out.set( 0, 0, 0, 1 );
  });
  fillRenderTarget(particleQuatTextureRead, function(out, x, y){
    out.set( 0, 0, 0, 1 );
  });
  fillRenderTarget(bodyQuatTextureRead, function(out, x, y){
    out.set( 0, 0, 0, 1 );
  });

  // main 3D scene
  scene = new THREE.Scene();
  var light = new THREE.DirectionalLight();
  light.position.set(10,10,20);
  scene.add(light);
  var ambientLight = new THREE.AmbientLight( 0x111111 );
  scene.add( ambientLight );
  camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set(2,1,7);
  initDebugGrid();

  // Create an instanced mesh for spheres
  var sphereGeometry = new THREE.SphereBufferGeometry(radius, 8, 8);
  var triangles = 1;
  var instances = numParticles*numParticles;
  var geometry = new THREE.InstancedBufferGeometry();
  geometry.maxInstancedCount = instances;
  for(var attributeName in sphereGeometry.attributes){
    geometry.addAttribute( attributeName, sphereGeometry.attributes[attributeName].clone() );
  }
  geometry.setIndex( sphereGeometry.index.clone() );
  var particleIndices = new THREE.InstancedBufferAttribute( new Float32Array( instances * 1 ), 1, 1 );
  for ( var i = 0, ul = particleIndices.count; i < ul; i++ ) {
    particleIndices.setX( i, i );
  }
  geometry.addAttribute( 'particleIndex', particleIndices );
  geometry.boundingSphere = null;

  // Spheres material - extend the phong shader in three.js
  var phongShader = THREE.ShaderLib.phong;
  var uniforms = THREE.UniformsUtils.clone(phongShader.uniforms);
  uniforms.posTex = { value: null };
  uniforms.quatTex = { value: null };
  uniforms.diffuse = { value: new THREE.Color() };
  var vert = [
    sharedShaderCode,
    "uniform sampler2D posTex;",
    "uniform sampler2D quatTex;",
    "attribute float particleIndex;",
    phongShader.vertexShader.replace(
      "<begin_vertex>",
      [
        "<begin_vertex>",
        "vec2 particleUV = indexToUV(particleIndex,resolution);",
        "vec4 quat = texture2D(quatTex,particleUV).xyzw;",
        "transformed.xyz = vec3_applyQuat(transformed.xyz, quat);",
        "transformed.xyz += texture2D(posTex,particleUV).xyz;",

      ].join("\n")
    ).replace(
      "#include <defaultnormal_vertex>",
      [
        "vec2 particleUV2 = indexToUV(particleIndex,resolution);",
        "vec4 quat2 = texture2D(quatTex,particleUV2).xyzw;",
        "objectNormal.xyz = vec3_applyQuat(objectNormal.xyz, quat2);",
        "#include <defaultnormal_vertex>",

      ].join("\n"))
  ].join('\n');
  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vert,
    fragmentShader: phongShader.fragmentShader,
    lights: true,
    defines: getDefines()
  });
  material.defines.USE_MAP = true;
  spheresMesh = new THREE.Mesh( geometry, material );
  spheresMesh.frustumCulled = false;
  var tex = new THREE.DataTexture(new Uint8Array([255,0,0,255, 255,255,255,255]), 1, 2, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping);
  tex.needsUpdate = true;
  material.uniforms.map.value = tex;
  scene.add( spheresMesh );

  // Position update
  updatePositionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex:  { value: null },
      velTex:  { value: null },
      params2: { value: params2 }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updatePositionFrag' ),
    defines: getDefines()
  });

  // Body position update
  updateBodyPositionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      bodyPosTex:  { value: null },
      bodyVelTex:  { value: null },
      params2: { value: params2 }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateBodyPositionFrag' ),
    defines: getDefines()
  });

  // Update velocity - should work for both linear and angular
  updateVelocityMaterial = new THREE.ShaderMaterial({
    uniforms: {
      forceTex:  { value: null },
      velTex:  { value: null },
      params2: { value: params2 },
      inertia: { value: 1 } // Inertia or mass
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateVelocityFrag' ),
    defines: getDefines()
  });

  // Update body velocity - should work for both linear and angular
  updateBodyVelocityMaterial = new THREE.ShaderMaterial({
    uniforms: {
      bodyForceTex:  { value: null },
      bodyVelTex:  { value: null },
      params2: { value: params2 },
      inertia: { value: 1 } // Inertia or mass
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateBodyVelocityFrag' ),
    defines: getDefines()
  });

  // Update quaternions
  updateQuaternionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      quatTex: { value: null },
      angularVelTex: { value: null },
      params2: { value: params2 }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateQuaternionFrag' ),
    defines: getDefines()
  });

  // Update body quaternions
  updateBodyQuaternionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      bodyQuatTex: { value: null },
      bodyAngularVelTex: { value: null },
      params2: { value: params2 }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateBodyQuaternionFrag' ),
    defines: getDefines()
  });

  // Update force material
  updateForceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      cellSize: { value: cellSize },
      gridPos: { value: gridPosition },
      posTex:  { value: null },
      velTex:  { value: null },
      gridTex:  { value: gridTexture.texture },
      gravity: { value: gravity },
      params1: { value: params1 },
      params2: { value: params2 },
      params3: { value: params3 },
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateForceFrag' ),
    defines: getDefines()
  });

  // Update torque material
  updateTorqueMaterial = new THREE.ShaderMaterial({
    uniforms: {
      cellSize: { value: cellSize },
      gridPos: { value: gridPosition },
      posTex:  { value: null },
      velTex:  { value: null },
      angularVelTex:  { value: null },
      gridTex:  { value: gridTexture.texture },
      params1: { value: params1 },
      params2: { value: params2 },
      params3: { value: params3 },
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateTorqueFrag' ),
    defines: getDefines()
  });

  // Add force to body material
  addForceToBodyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      relativeParticlePosTex:  { value: null },
      particleForceTex:  { value: null },
    },
    vertexShader: getShader( 'addParticleForceToBodyVert' ),
    fragmentShader: getShader( 'addParticleForceToBodyFrag' ),
    defines: getDefines(),
    blending: THREE.AdditiveBlending
  });

  // Add torque to body material - needed?
  addTorqueToBodyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      relativeParticlePosTex: { value: null },
      particleForceTex: { value: null },
    },
    vertexShader: getShader( 'addParticleTorqueToBodyVert' ),
    fragmentShader: getShader( 'addParticleForceToBodyFrag' ), // reuse
    defines: getDefines(),
    blending: THREE.AdditiveBlending
  });

  // localParticlePositionToWorld
  localParticlePositionToWorldMaterial = new THREE.ShaderMaterial({
    uniforms: {
      localParticlePosTex:  { value: null },
      bodyPosTex: { value: null },
      bodyQuatTex: { value: null },
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'localParticlePositionToWorldFrag' ),
    defines: getDefines()
  });

  // localParticlePositionToRelative
  localParticlePositionToRelativeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      localParticlePosTex:  { value: null },
      bodyPosTex:  { value: null },
      bodyQuatTex:  { value: null },
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'localParticlePositionToRelativeFrag' ),
    defines: getDefines()
  });

  // bodyVelocityToParticleVelocity
  bodyVelocityToParticleVelocityMaterial = new THREE.ShaderMaterial({
    uniforms: {
      relativeParticlePosTex:  { value: null },
      bodyVelTex:  { value: null },
      bodyAngularVelTex:  { value: null },
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'bodyVelocityToParticleVelocityFrag' ),
    defines: getDefines()
  });

  // Scene for mapping the particle positions to the grid cells - one GL_POINT for each particle
  sceneMap = new THREE.Scene();
  mapParticleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: null },
      cellSize: { value: cellSize },
      gridPos: { value: gridPosition },
    },
    vertexShader: getShader( 'mapParticleToCellVert' ),
    fragmentShader: getShader( 'mapParticleToCellFrag' ),
    defines: getDefines()
  });
  var mapParticleGeometry = new THREE.BufferGeometry();
  var positions = new Float32Array( 3 * numParticles * numParticles );
  var particleIndices = new Float32Array( numParticles * numParticles );
  for(var i=0; i<numParticles*numParticles; i++){
    particleIndices[i] = i;
  }
  mapParticleGeometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  mapParticleGeometry.addAttribute( 'particleIndex', new THREE.BufferAttribute( particleIndices, 1 ) );
  mapParticleToCellMesh = new THREE.Points( mapParticleGeometry, mapParticleMaterial );
  sceneMap.add( mapParticleToCellMesh );

  // Scene for rendering the stencil buffer - one GL_POINT for each grid cell that we render 4 times
  sceneStencil = new THREE.Scene();
  var onePointPerTexelGeometry = new THREE.Geometry();
  for(var i=0; i<gridTexture.width/2; i++){
    for(var j=0; j<gridTexture.height/2; j++){
      onePointPerTexelGeometry.vertices.push(
        new THREE.Vector3(
          2*i/(gridTexture.width/2)-1,
          2*j/(gridTexture.height/2)-1,
          0
        )
      );
    }
  }
  setGridStencilMaterial = new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, color: 0xffffff });
  setGridStencilMesh = new THREE.Points( onePointPerTexelGeometry, setGridStencilMaterial );
  sceneStencil.add( setGridStencilMesh );

  // Scene for mapping the particle force to bodies - one GL_POINT for each particle
  sceneMapParticlesToBodies = new THREE.Scene();
  var mapParticleToBodyGeometry = new THREE.BufferGeometry();
  var bodyIndices = new Float32Array( numParticles * numParticles );
  var particleIndices = new Float32Array( numParticles * numParticles );
  for(var i=0; i<numParticles*numParticles; i++){
    particleIndices[i] = i;
    bodyIndices[i] = i; // one for each particle... for now
  }
  mapParticleToBodyGeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array(numParticles*numParticles*3), 3 ) );
  mapParticleToBodyGeometry.addAttribute( 'bodyIndex', new THREE.BufferAttribute( bodyIndices, 1 ) );
  mapParticleToBodyGeometry.addAttribute( 'particleIndex', new THREE.BufferAttribute( particleIndices, 1 ) );
  mapParticleToBodyMesh = new THREE.Points( mapParticleToBodyGeometry, addForceToBodyMaterial );
  sceneMapParticlesToBodies.add( mapParticleToBodyMesh );

  // Debug quads
  /*
  addDebugQuad('positions', 1, 1, 1, function(){ return particlePosTextureRead.texture; });
  addDebugQuad('grid', 1, 1, 1/(numParticles*numParticles), function(){ return gridTexture.texture; });
  addDebugQuad('angularVelocity', 1, 1, 1, function(){ return bodyAngularVelTextureRead.texture; });
  */
  addDebugQuad('bodyForce', 1, 1, 1, function(){ return bodyForceTexture.texture; });

  // Add controls
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.enableZoom = true;
  controls.target.set(0.5, 0.4, 0.5);

  var mesh=new THREE.Mesh(new THREE.SphereBufferGeometry(params3.w,16,16), new THREE.MeshPhongMaterial({ color: 0xffffff }));
  gizmo = new THREE.TransformControls( camera, renderer.domElement );
  gizmo.addEventListener( 'change', function(){
    params3.x = mesh.position.x;
    params3.y = mesh.position.y;
    params3.z = mesh.position.z;
  });
  mesh.position.set(0.5,0.5,0.5);
  scene.add(mesh);
  gizmo.attach(mesh);
  scene.add(gizmo);
}

function createRenderTarget(w,h,format){
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: format === undefined ? THREE.RGBAFormat : format,
    type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
  });
}

function initDebugGrid(){
  if(!showDebugGrid) return;
  var w = gridResolution.x*cellSize.x;
  var h = gridResolution.y*cellSize.y;
  var d = gridResolution.z*cellSize.z;
  var boxGeom = new THREE.BoxGeometry( w, h, d );
  var wireframeMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
  debugGridMesh = new THREE.Mesh(boxGeom,wireframeMaterial);
  debugGridMesh.position.copy(gridPosition);
  debugGridMesh.position.x += w/2;
  debugGridMesh.position.y += h/2;
  debugGridMesh.position.z += d/2;
  scene.add(debugGridMesh);
}
function updateDebugGrid(){
  if(!showDebugGrid) return;
  var w = gridResolution.x*cellSize.x;
  var h = gridResolution.y*cellSize.y;
  var d = gridResolution.z*cellSize.z;
  debugGridMesh.position.copy(gridPosition);
  debugGridMesh.position.x += w/2;
  debugGridMesh.position.y += h/2;
  debugGridMesh.position.z += d/2;
}

function fillRenderTarget(renderTarget, getPixelFunc){
  var w = renderTarget.width;
  var h = renderTarget.height;

  var data = new Float32Array(w*h*4);
  pixel = new THREE.Vector4();
  for(var i=0; i<w; i++){
    for(var j=0; j<h; j++){
      pixel.set(0,0,0,1);
      getPixelFunc(pixel, i, j);
      var p = (i*w + j) * 4;
      data[p + 0] = pixel.x;
      data[p + 1] = pixel.y;
      data[p + 2] = pixel.z;
      data[p + 3] = pixel.w;
    }
  }
  var key = w + 'x' + h;
  //if(!dataTex[key]){ // not working properly?
    dataTex[key] = new THREE.DataTexture( data, w, h, THREE.RGBAFormat, THREE.FloatType );
  //}
  dataTex[key].needsUpdate = true;
  texturedMaterial.uniforms.texture.value = dataTex[key];
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, renderTarget, true );
  texturedMaterial.uniforms.texture.value = null;
}

function addDebugQuad(name, sizeX, sizeY, colorScale, getTextureFunc){
  colorScale = colorScale || 1;
  var geometry = new THREE.PlaneBufferGeometry( sizeX||1, sizeY||1 );
  var mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorScale,colorScale,colorScale) });
  var mesh = new THREE.Mesh( geometry, mat );
  var numDebugQuads = Object.keys(debugQuads).length;
  mesh.position.set((numDebugQuads)*1.1, -1, 0);
  mesh.onBeforeRender = function(){
    var tex = getTextureFunc();
    this.material.map = tex;
  };
  debugQuads[name] = mesh;
  scene.add( mesh );
  return mesh;
}
function updateDebugQuads(){
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
  requestAnimationFrame( animate );
  render();
}

function render() {
  controls.update();

  simulate();

  // Render main scene
  updateDebugGrid();
  updateDebugQuads();
  spheresMesh.material.uniforms.posTex.value = particlePosTextureRead.texture;
  spheresMesh.material.uniforms.quatTex.value = particleQuatTextureRead.texture;
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x222222, 1.0);
  renderer.clear();
  renderer.render( scene, camera, null, false );
  spheresMesh.material.uniforms.posTex.value = null;
  spheresMesh.material.uniforms.quatTex.value = null;
}

function simulate(){

  // Local particle positions to world
  fullScreenQuad.material = localParticlePositionToWorldMaterial;
  localParticlePositionToWorldMaterial.uniforms.localParticlePosTex.value = particlePosLocalTexture.texture;
  localParticlePositionToWorldMaterial.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
  localParticlePositionToWorldMaterial.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particlePosWorldTexture, false );
  localParticlePositionToWorldMaterial.uniforms.localParticlePosTex.value = null;
  localParticlePositionToWorldMaterial.uniforms.bodyPosTex.value = null;
  localParticlePositionToWorldMaterial.uniforms.bodyQuatTex.value = null;

  // Local particle positions to relative
  fullScreenQuad.material = localParticlePositionToRelativeMaterial;
  localParticlePositionToRelativeMaterial.uniforms.localParticlePosTex.value = particlePosLocalTexture.texture;
  localParticlePositionToRelativeMaterial.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
  localParticlePositionToRelativeMaterial.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particlePosRelativeTexture, false );
  localParticlePositionToRelativeMaterial.uniforms.localParticlePosTex.value = null;
  localParticlePositionToRelativeMaterial.uniforms.bodyPosTex.value = null;
  localParticlePositionToRelativeMaterial.uniforms.bodyQuatTex.value = null;

  // Try drawing a rectangle to the stencil buffer to mask out a square
  var gl = renderer.context;
  var state = renderer.state;

  // Set up the grid texture for stencil routing.
  // See http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf slide 24
  renderer.setClearColor( 0x000000, 1.0 );
  renderer.clearTarget( gridTexture, true, false, true );
  state.buffers.depth.setTest( false );
  state.buffers.depth.setMask( false ); // dont draw depth
  state.buffers.color.setMask( false ); // dont draw color
  state.buffers.color.setLocked( true );
  state.buffers.depth.setLocked( true );
  state.buffers.stencil.setTest( true );
  state.buffers.stencil.setOp( gl.REPLACE, gl.REPLACE, gl.REPLACE );
  state.buffers.stencil.setClear( 0 );
  setGridStencilMaterial.color.setRGB(1,1,1);
  var gridSizeX = gridTexture.width;
  var gridSizeY = gridTexture.height;
  for(var i=0;i<2;i++){
    for(var j=0;j<2;j++){
      var x = i, y = j;
      var stencilValue = i + j * 2;
      if(stencilValue === 0){
        continue; // No need to set 0 stencil value, it's already cleared
      }
      state.buffers.stencil.setFunc( gl.ALWAYS, stencilValue, 0xffffffff );
      setGridStencilMesh.position.set((x+2)/gridSizeX,(y+2)/gridSizeY,0);
      renderer.render( sceneStencil, fullscreenQuadCamera, gridTexture, false );
    }
  }
  state.buffers.color.setLocked( false );
  state.buffers.color.setMask( true );
  state.buffers.depth.setLocked( false );
  state.buffers.depth.setMask( true );

  // Draw particle positions to grid, use stencil routing.
  state.buffers.stencil.setFunc( gl.EQUAL, 3, 0xffffffff );
  state.buffers.stencil.setOp( gl.INCR, gl.INCR, gl.INCR ); // Increment stencil value for every rendered fragment
  mapParticleToCellMesh.material = mapParticleMaterial;
  mapParticleMaterial.uniforms.posTex.value = particlePosTextureRead.texture;
  renderer.render( sceneMap, fullscreenQuadCamera, gridTexture, false );
  mapParticleMaterial.uniforms.posTex.value = null;
  state.buffers.stencil.setTest( false );

  // Update particle forces / collision reaction
  fullScreenQuad.material = updateForceMaterial;
  updateForceMaterial.uniforms.posTex.value = particlePosTextureRead.texture;
  updateForceMaterial.uniforms.velTex.value = particleVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleForceTexture, false );
  updateForceMaterial.uniforms.velTex.value = null;
  updateForceMaterial.uniforms.posTex.value = null;

  // Update torque / collision reaction - needed?
  fullScreenQuad.material = updateTorqueMaterial;
  updateTorqueMaterial.uniforms.posTex.value = particlePosTextureRead.texture;
  updateTorqueMaterial.uniforms.velTex.value = particleVelTextureRead.texture;
  updateTorqueMaterial.uniforms.angularVelTex.value = particleAngularVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleTorqueTexture, false );
  updateTorqueMaterial.uniforms.velTex.value = null;
  updateTorqueMaterial.uniforms.posTex.value = null;
  updateTorqueMaterial.uniforms.angularVelTex.value = null;

  // Add force to bodies
  renderer.clearTarget(bodyForceTexture, true, false, false );
  mapParticleToBodyMesh.material = addForceToBodyMaterial;
  addForceToBodyMaterial.uniforms.relativeParticlePosTex.value = particlePosRelativeTexture.texture;
  addForceToBodyMaterial.uniforms.particleForceTex.value = particleForceTexture.texture;
  renderer.render( sceneMapParticlesToBodies, fullscreenQuadCamera, bodyForceTexture, false );
  addForceToBodyMaterial.uniforms.relativeParticlePosTex.value = null;
  addForceToBodyMaterial.uniforms.particleForceTex.value = null;

  // Update particle velocity
  fullScreenQuad.material = updateVelocityMaterial;
  updateVelocityMaterial.uniforms.inertia.value = 1; // sphere mass == 1
  updateVelocityMaterial.uniforms.velTex.value = particleVelTextureRead.texture;
  updateVelocityMaterial.uniforms.forceTex.value = particleForceTexture.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleVelTextureWrite, false );
  updateVelocityMaterial.uniforms.velTex.value = null;
  updateVelocityMaterial.uniforms.forceTex.value = null;
  var tmp = particleVelTextureWrite;
  particleVelTextureWrite = particleVelTextureRead;
  particleVelTextureRead = tmp;

  // Update body velocity
  fullScreenQuad.material = updateBodyVelocityMaterial;
  updateBodyVelocityMaterial.uniforms.inertia.value = 1; // sphere mass == 1
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = bodyVelTextureRead.texture;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = bodyForceTexture.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, bodyVelTextureWrite, false );
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = null;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = null;
  var tmp = bodyVelTextureWrite;
  bodyVelTextureWrite = bodyVelTextureRead;
  bodyVelTextureRead = tmp;

  // Update positions
  fullScreenQuad.material = updatePositionMaterial;
  updatePositionMaterial.uniforms.posTex.value = particlePosTextureRead.texture;
  updatePositionMaterial.uniforms.velTex.value = particleVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particlePosTextureWrite, false );
  updatePositionMaterial.uniforms.velTex.value = null;
  updatePositionMaterial.uniforms.posTex.value = null;
  tmp = particlePosTextureWrite; // swap
  particlePosTextureWrite = particlePosTextureRead;
  particlePosTextureRead = tmp;

  // Update body positions
  fullScreenQuad.material = updateBodyPositionMaterial;
  updateBodyPositionMaterial.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
  updateBodyPositionMaterial.uniforms.bodyVelTex.value = bodyVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, bodyPosTextureWrite, false );
  updateBodyPositionMaterial.uniforms.bodyVelTex.value = null;
  updateBodyPositionMaterial.uniforms.bodyPosTex.value = null;
  tmp = bodyPosTextureWrite; // swap
  bodyPosTextureWrite = bodyPosTextureRead;
  bodyPosTextureRead = tmp;

  // Update angular velocity
  fullScreenQuad.material = updateVelocityMaterial;
  updateVelocityMaterial.uniforms.inertia.value = (2.0 * 1.0 * radius * radius / 5.0); // sphere with mass 1
  updateVelocityMaterial.uniforms.velTex.value = particleAngularVelTextureRead.texture;
  updateVelocityMaterial.uniforms.forceTex.value = particleTorqueTexture.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleAngularVelTextureWrite, false );
  updateVelocityMaterial.uniforms.velTex.value = null;
  updateVelocityMaterial.uniforms.forceTex.value = null;
  tmp = particleAngularVelTextureWrite;
  particleAngularVelTextureWrite = particleAngularVelTextureRead;
  particleAngularVelTextureRead = tmp;

  // Update body angular velocity
  fullScreenQuad.material = updateBodyVelocityMaterial;
  updateBodyVelocityMaterial.uniforms.inertia.value = (2.0 * 1.0 * radius * radius / 5.0); // sphere with mass 1
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = bodyAngularVelTextureRead.texture;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = bodyTorqueTexture.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, bodyAngularVelTextureWrite, false );
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = null;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = null;
  tmp = bodyAngularVelTextureWrite;
  bodyAngularVelTextureWrite = bodyAngularVelTextureRead;
  bodyAngularVelTextureRead = tmp;

  // Update particle quaternions
  fullScreenQuad.material = updateQuaternionMaterial;
  updateQuaternionMaterial.uniforms.quatTex.value = particleQuatTextureRead.texture;
  updateQuaternionMaterial.uniforms.angularVelTex.value = particleAngularVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleQuatTextureWrite, false );
  updateQuaternionMaterial.uniforms.quatTex.value = null;
  updateQuaternionMaterial.uniforms.angularVelTex.value = null;
  tmp = particleQuatTextureWrite;
  particleQuatTextureWrite = particleQuatTextureRead;
  particleQuatTextureRead = tmp;

  // Update body quaternions
  fullScreenQuad.material = updateBodyQuaternionMaterial;
  updateBodyQuaternionMaterial.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;
  updateBodyQuaternionMaterial.uniforms.bodyAngularVelTex.value = bodyAngularVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, bodyQuatTextureWrite, false );
  updateBodyQuaternionMaterial.uniforms.bodyQuatTex.value = null;
  updateBodyQuaternionMaterial.uniforms.bodyAngularVelTex.value = null;
  tmp = bodyQuatTextureWrite;
  bodyQuatTextureWrite = bodyQuatTextureRead;
  bodyQuatTextureRead = tmp;

  state.buffers.depth.setTest( true );
}