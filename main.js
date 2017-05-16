var query = parseParams();

var paused = false;
var numParticles = query.n ? parseInt(query.n,10) : 64;
//var numBodies = numParticles/2;
var numBodies = numParticles/2;
var gridResolution = new THREE.Vector3(numParticles/2, numParticles/16, numParticles/2);
var gridPosition = new THREE.Vector3(0.25,0.29,0.25);
var cellSize = new THREE.Vector3(1/numParticles,1/numParticles,1/numParticles);
var radius = cellSize.x * 0.5;
var gravity = new THREE.Vector3(0.0,-0.5,0);
var params1 = new THREE.Vector4(
  1700, // stiffness
  6, // damping
  radius, // radius
  0.2 // drag
);
var params2 = new THREE.Vector4(
  1/120, // time step
  1, // friction damping
  0.1, // velocity damping
  0 // unused
);
var params3 = new THREE.Vector4(0.5,0.6,0.5,0.05);
function getBodyId(particleId){
  //var bodyId = Math.floor(particleId / 4);
  var bodyId = particleId;
  return bodyId;
}
function getParticleLocalPos(out, particleId){
  var x = 0;//(particleId % 4 - 1.5) * radius * 2.01;
  out.set(x,0,0);
}

var mass = 1;
var invMass = new THREE.Vector3(1/mass,1/mass,1/mass);
var invInertia = new THREE.Vector3(1,1,1);
calculateBoxInvInertia(invInertia, 1, new THREE.Vector3(radius*2,radius*2,radius*2));
var gridPotZ;
var container, stats, controls;
var fullscreenQuadCamera, camera, fullscreenQuadScene, scene, renderer;
var fullScreenQuad, mesh;
var sceneMap, sceneMapParticlesToBodies;
var setGridStencilMaterial, setGridStencilMesh;
var texturedMaterial;
var mapParticleMaterial;
var forceMaterial;
var updateTorqueMaterial;
var debugQuads = {};
var mapParticleToCellMesh;
var debugMesh;
var sharedShaderCode;
var debugGridMesh;
var localParticlePositionToWorldMaterial;
var addForceToBodyMaterial;
var updateBodyVelocityMaterial;
var gizmo;

var bodyPosTextureRead;
var bodyPosTextureWrite;
var bodyQuatTextureRead;
var bodyQuatTextureWrite;
var bodyVelTextureRead;
var bodyVelTextureWrite;
var bodyAngularVelTextureRead;
var bodyAngularVelTextureWrite;
var bodyForceTexture;
var bodyTorqueTexture;
var particlePosLocalTexture;
var particlePosRelativeTexture;
var particlePosWorldTexture;
var particleVelTexture;
var particleForceTexture;
var particleTorqueTexture;
var gridTexture;

init();
animate();

function getShader(id){
  var code = document.getElementById( id ).textContent;
  return sharedShaderCode + code;
}

function getDefines(overrides){
  return Object.assign({}, overrides||{}, {
    resolution: 'vec2( ' + numParticles.toFixed( 1 ) + ', ' + numParticles.toFixed( 1 ) + " )",
    gridResolution: 'vec3( ' + gridResolution.x.toFixed( 1 ) + ', ' + gridResolution.y.toFixed( 1 ) + ', ' + gridResolution.z.toFixed( 1 ) + " )",
    gridPotZ: 'int(' + gridPotZ + ')',
    bodyTextureResolution: 'vec2( ' + numBodies.toFixed( 1 ) + ', ' + numBodies.toFixed( 1 ) + " )",
  });
}

function init() {
  container = document.getElementById( 'container' );
  sharedShaderCode = document.getElementById( 'sharedShaderCode' ).textContent;

  // Compute upper closest power of 2 for the grid texture size in z
  gridPotZ = 1;
  while(gridPotZ*gridPotZ < gridResolution.z){
    gridPotZ *= 2;
  }

  // Set up renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( 1/*window.devicePixelRatio*/ ); // For some reason, device pixel ratio messes up the rendertargets on mobile
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.autoClear = false;
  container.appendChild( renderer.domElement );
  window.addEventListener( 'resize', onWindowResize, false );

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  container.appendChild( stats.domElement );

  texturedMaterial = new THREE.ShaderMaterial({
    uniforms: {
      texture: { value: null },
      res: { value: new THREE.Vector2() },
    },
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

  // Body textures
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
  particleVelTexture = createRenderTarget(numParticles, numParticles);
  particleForceTexture = createRenderTarget(numParticles, numParticles);
  particleTorqueTexture = createRenderTarget(numParticles, numParticles);

  // Broadphase
  gridTexture = createRenderTarget(2*gridResolution.x*gridPotZ, 2*gridResolution.y*gridPotZ);

  console.log((numParticles*numParticles) + ' particles');
  console.log((numBodies*numBodies) + ' bodies');
  console.log('Grid texture is ' + (2*gridResolution.x*gridPotZ) + 'x' + (2*gridResolution.y*gridPotZ));

  function pixelToId(x,y,sx,sy){
    return x*sx + y; // not sure why this is flipped 90 degrees compared to the shader impl?
  }

  // Initial state
  var tempVec = new THREE.Vector3();
  fillRenderTarget(particlePosLocalTexture, function(out, x, y){
    var particleId = pixelToId(x,y,numParticles,numParticles);
    getParticleLocalPos(tempVec, particleId);
    var bodyId =  getBodyId(particleId);
    out.set( tempVec.x, tempVec.y, tempVec.z, bodyId );
  });
  fillRenderTarget(bodyVelTextureRead, function(out, x, y){
    out.set( 0, 0, 0, 1 );
  });
  fillRenderTarget(bodyAngularVelTextureRead, function(out, x, y){
    out.set( 0, 0, 0, 0 );
  });
  fillRenderTarget(bodyPosTextureRead, function(out, x, y){
    out.set( 0.35 + 0.3*Math.random(), 0.1*Math.random() + 0.3, 0.35 + 0.3*Math.random(), 1 );
    //out.set( radius + 2*x*radius, radius*1.2 + (y*numParticles+x) * radius*0.4,radius + 2*y*radius,  1 );
    //out.set( 0, 0, 0, 1 );
    //out.set( x, y, 0, 1 );
  });
  fillRenderTarget(bodyQuatTextureRead, function(out, x, y){
    // out.set( 0, 0, 0, 1 );
    // out.set( 0, 0, Math.sin(Math.PI / 2), Math.cos(Math.PI / 2) );
    var q = new THREE.Quaternion();
    /*var axis = new THREE.Vector3(
      Math.random()-0.5,
      Math.random()-0.5,
      Math.random()-0.5
    );
    axis.normalize();
    q.setFromAxisAngle(axis, Math.random() * Math.PI * 2);*/
    q.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI / 2);
    out.copy(q);
  });

  // main 3D scene
  scene = new THREE.Scene();
  var light = new THREE.DirectionalLight();
  light.position.set(10,10,20);
  scene.add(light);
  var ambientLight = new THREE.AmbientLight( 0x111111 );
  scene.add( ambientLight );
  camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set(1.5,0.7,1.1);
  initDebugGrid();

  // Create an instanced mesh for debug spheres
  var sphereGeometry = new THREE.SphereBufferGeometry(radius, 8, 8);
  var instances = numParticles*numParticles;
  var debugGeometry = new THREE.InstancedBufferGeometry();
  debugGeometry.maxInstancedCount = instances;
  for(var attributeName in sphereGeometry.attributes){
    debugGeometry.addAttribute( attributeName, sphereGeometry.attributes[attributeName].clone() );
  }
  debugGeometry.setIndex( sphereGeometry.index.clone() );
  var particleIndices = new THREE.InstancedBufferAttribute( new Float32Array( instances * 1 ), 1, 1 );
  for ( var i = 0, ul = particleIndices.count; i < ul; i++ ) {
    particleIndices.setX( i, i );
  }
  debugGeometry.addAttribute( 'particleIndex', particleIndices );
  debugGeometry.boundingSphere = null;

  // Particle spheres material / debug material - extend the phong shader in three.js
  var phongShader = THREE.ShaderLib.phong;
  var uniforms = THREE.UniformsUtils.clone(phongShader.uniforms);
  uniforms.particleWorldPosTex = { value: null };
  uniforms.quatTex = { value: null };
  var debugMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: getShader('renderParticlesVertex'),
    fragmentShader: phongShader.fragmentShader,
    lights: true,
    defines: getDefines({
      USE_MAP: true,
      //USE_COLOR: true
    })
  });
  debugMesh = new THREE.Mesh( debugGeometry, debugMaterial );
  debugMesh.frustumCulled = false;
  var checkerTexture = new THREE.DataTexture(new Uint8Array([255,0,0,255, 255,255,255,255, 255,255,255,255, 255,0,0,255]), 2, 2, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping);
  checkerTexture.needsUpdate = true;
  debugMaterial.uniforms.map.value = checkerTexture;


  // Create an instanced mesh for cylinders
  var cylinderGeometry = new THREE.CylinderBufferGeometry(radius, radius, 2*4*radius, 8);
  cylinderGeometry.rotateZ(Math.PI / 2);// particles are spread along x, not y
  var bodyInstances = numBodies*numBodies;
  var meshGeometry = new THREE.InstancedBufferGeometry();
  meshGeometry.maxInstancedCount = bodyInstances;
  for(var attributeName in cylinderGeometry.attributes){
    meshGeometry.addAttribute( attributeName, cylinderGeometry.attributes[attributeName].clone() );
  }
  meshGeometry.setIndex( cylinderGeometry.index.clone() );
  var bodyIndices = new THREE.InstancedBufferAttribute( new Float32Array( bodyInstances * 1 ), 1, 1 );
  for ( var i = 0, ul = bodyIndices.count; i < ul; i++ ) {
    bodyIndices.setX( i, i ); // one index per instance
  }
  meshGeometry.addAttribute( 'bodyIndex', bodyIndices );
  meshGeometry.boundingSphere = null;

  // Mesh material - extend the phong shader
  var meshUniforms = THREE.UniformsUtils.clone(phongShader.uniforms);
  meshUniforms.bodyQuatTex = { value: null };
  meshUniforms.bodyPosTex = { value: null };
  meshVertexShader = getShader('renderBodiesVertex');
  var meshMaterial = new THREE.ShaderMaterial({
    uniforms: meshUniforms,
    vertexShader: meshVertexShader,
    fragmentShader: phongShader.fragmentShader,
    lights: true,
    defines: getDefines({
      USE_MAP: true,
      //USE_COLOR: true,
    })
  });
  meshMaterial.uniforms.map.value = checkerTexture;
  meshMesh = new THREE.Mesh( meshGeometry, meshMaterial );
  meshMesh.frustumCulled = false;
  scene.add( meshMesh );

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

  // Update body velocity - should work for both linear and angular
  updateBodyVelocityMaterial = new THREE.ShaderMaterial({
    uniforms: {
      bodyQuatTex:  { value: null },
      bodyForceTex:  { value: null },
      bodyVelTex:  { value: null },
      params2: { value: params2 },
      invInertia: { value: invInertia }, // Inertia or mass
      maxVelocity: { value: new THREE.Vector3(10000,10000,10000) }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateBodyVelocityFrag' ),
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
  forceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      cellSize: { value: cellSize },
      gridPos: { value: gridPosition },
      posTex:  { value: null },
      velTex:  { value: null },
      bodyAngularVelTex:  { value: null },
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
      bodyAngularVelTex:  { value: null },
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
      globalForce:  { value: gravity },
    },
    vertexShader: getShader( 'addParticleForceToBodyVert' ),
    fragmentShader: getShader( 'addParticleForceToBodyFrag' ),
    defines: getDefines(),
    blending: THREE.AdditiveBlending,
    transparent: true
  });

  // Add torque to body material
  addTorqueToBodyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      relativeParticlePosTex: { value: null },
      particleForceTex: { value: null },
      particleTorqueTex: { value: null },
      globalForce:  { value: new THREE.Vector3(0,0,0) },
    },
    vertexShader: getShader( 'addParticleTorqueToBodyVert' ),
    fragmentShader: getShader( 'addParticleForceToBodyFrag' ), // reuse
    defines: getDefines(),
    blending: THREE.AdditiveBlending,
    transparent: true
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
    var particleId = i//numParticles*numParticles - 1 - i;
    particleIndices[i] = particleId;
    bodyIndices[i] = getBodyId(particleId); // one for each particle... for now
  }
  mapParticleToBodyGeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array(numParticles*numParticles*3), 3 ) );
  mapParticleToBodyGeometry.addAttribute( 'bodyIndex', new THREE.BufferAttribute( bodyIndices, 1 ) );
  mapParticleToBodyGeometry.addAttribute( 'particleIndex', new THREE.BufferAttribute( particleIndices, 1 ) );
  mapParticleToBodyMesh = new THREE.Points( mapParticleToBodyGeometry, addForceToBodyMaterial );
  sceneMapParticlesToBodies.add( mapParticleToBodyMesh );

  // Debug quads
  //addDebugQuad('particlePos', 1, 1, 1, function(){ return particlePosWorldTexture.texture; });
  //addDebugQuad('bodyPos', 1, 1, 1, function(){ return bodyPosTextureRead.texture; });
  //addDebugQuad('bodyVel', 1, 1, 1, function(){ return bodyVelTextureRead.texture; });
  //addDebugQuad('particleVel', 1, 1, 1, function(){ return particleVelTexture.texture; });
  //addDebugQuad('particleForce', 1, 1, 1, function(){ return particleForceTexture.texture; });
  //addDebugQuad('bodyForce', 1, 1, 1, function(){ return bodyForceTexture.texture; });
  //addDebugQuad('particleRelPos', 1, 1, 1, function(){ return particlePosRelativeTexture.texture; });
  //addDebugQuad('grid', 1, 1, 1/(numParticles*numParticles), function(){ return gridTexture.texture; });
  //addDebugQuad('angularVelocity', 1, 1, 1, function(){ return bodyAngularVelTextureRead.texture; });

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
  mesh.position.set(params3.x,params3.y,params3.z);
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
}
function updateDebugGrid(){
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
  var dataTex = new THREE.DataTexture( data, w, h, THREE.RGBAFormat, THREE.FloatType );
  dataTex.needsUpdate = true;
  texturedMaterial.uniforms.texture.value = dataTex;
  texturedMaterial.uniforms.res.value.set(w,h);
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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
  requestAnimationFrame( animate );
  render();
  stats.update();
}

function render() {
  controls.update();

  if(!paused)
    simulate();

  // Render main scene
  updateDebugGrid();

  debugMesh.material.uniforms.particleWorldPosTex.value = particlePosWorldTexture.texture;
  debugMesh.material.uniforms.quatTex.value = bodyQuatTextureRead.texture;

  meshMesh.material.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
  meshMesh.material.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;

  renderer.setRenderTarget(null);
  renderer.setClearColor(0x222222, 1.0);
  renderer.clear();
  renderer.render( scene, camera );

  meshMesh.material.uniforms.bodyPosTex.value = null;
  meshMesh.material.uniforms.bodyQuatTex.value = null;

  debugMesh.material.uniforms.particleWorldPosTex.value = null;
  debugMesh.material.uniforms.quatTex.value = null;
}

function simulate(){

  var gl = renderer.context;
  var state = renderer.state;
  state.buffers.depth.setTest( false );
  state.buffers.stencil.setTest( false );

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

  // Body velocity to particles in world space
  fullScreenQuad.material = bodyVelocityToParticleVelocityMaterial;
  bodyVelocityToParticleVelocityMaterial.uniforms.relativeParticlePosTex.value = particlePosRelativeTexture.texture;
  bodyVelocityToParticleVelocityMaterial.uniforms.bodyVelTex.value = bodyVelTextureRead.texture;
  bodyVelocityToParticleVelocityMaterial.uniforms.bodyAngularVelTex.value = bodyAngularVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleVelTexture, false );
  bodyVelocityToParticleVelocityMaterial.uniforms.relativeParticlePosTex.value = null;
  bodyVelocityToParticleVelocityMaterial.uniforms.bodyVelTex.value = null;
  bodyVelocityToParticleVelocityMaterial.uniforms.bodyAngularVelTex.value = null;

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
  mapParticleMaterial.uniforms.posTex.value = particlePosWorldTexture.texture;
  renderer.render( sceneMap, fullscreenQuadCamera, gridTexture, false );
  mapParticleMaterial.uniforms.posTex.value = null;
  state.buffers.stencil.setTest( false );

  // Update particle forces / collision reaction
  state.buffers.depth.setTest( false );
  state.buffers.stencil.setTest( false );
  fullScreenQuad.material = forceMaterial;
  forceMaterial.uniforms.posTex.value = particlePosWorldTexture.texture;
  forceMaterial.uniforms.velTex.value = particleVelTexture.texture;
  forceMaterial.uniforms.bodyAngularVelTex.value = bodyAngularVelTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleForceTexture, false );
  forceMaterial.uniforms.velTex.value = null;
  forceMaterial.uniforms.posTex.value = null;
  forceMaterial.uniforms.bodyAngularVelTex.value = null;

  // Update particle torques / collision reaction
  state.buffers.depth.setTest( false );
  state.buffers.stencil.setTest( false );
  fullScreenQuad.material = updateTorqueMaterial;
  updateTorqueMaterial.uniforms.posTex.value = particlePosWorldTexture.texture;
  updateTorqueMaterial.uniforms.velTex.value = particleVelTexture.texture;
  updateTorqueMaterial.uniforms.bodyAngularVelTex.value = bodyAngularVelTextureRead.texture; // Angular velocity for indivitual particles and bodies are the same
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, particleTorqueTexture, false );
  updateTorqueMaterial.uniforms.velTex.value = null;
  updateTorqueMaterial.uniforms.bodyAngularVelTex.value = null;
  updateTorqueMaterial.uniforms.posTex.value = null;

  // Add force to bodies
  state.buffers.depth.setTest( false );
  state.buffers.stencil.setTest( false );
  renderer.setClearColor( 0x000000, 1.0 );
  renderer.clearTarget(bodyForceTexture, true, true, true ); // clear the color only?
  mapParticleToBodyMesh.material = addForceToBodyMaterial;
  addForceToBodyMaterial.uniforms.relativeParticlePosTex.value = particlePosRelativeTexture.texture;
  addForceToBodyMaterial.uniforms.particleForceTex.value = particleForceTexture.texture;
  renderer.render( sceneMapParticlesToBodies, fullscreenQuadCamera, bodyForceTexture, false );
  addForceToBodyMaterial.uniforms.relativeParticlePosTex.value = null;
  addForceToBodyMaterial.uniforms.particleForceTex.value = null;

  // Add torque to bodies
  renderer.clearTarget(bodyTorqueTexture, true, true, true ); // clear the color only?
  mapParticleToBodyMesh.material = addTorqueToBodyMaterial;
  addTorqueToBodyMaterial.uniforms.relativeParticlePosTex.value = particlePosRelativeTexture.texture;
  addTorqueToBodyMaterial.uniforms.particleForceTex.value = particleForceTexture.texture;
  addTorqueToBodyMaterial.uniforms.particleTorqueTex.value = particleTorqueTexture.texture;
  renderer.render( sceneMapParticlesToBodies, fullscreenQuadCamera, bodyTorqueTexture, false );
  addTorqueToBodyMaterial.uniforms.relativeParticlePosTex.value = null;
  addTorqueToBodyMaterial.uniforms.particleForceTex.value = null;
  addTorqueToBodyMaterial.uniforms.particleTorqueTex.value = null;

  // Update body velocity
  fullScreenQuad.material = updateBodyVelocityMaterial;
  updateBodyVelocityMaterial.uniforms.invInertia.value = invMass;
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = bodyVelTextureRead.texture;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = bodyForceTexture.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, bodyVelTextureWrite, false );
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = null;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = null;
  var tmp = bodyVelTextureWrite;
  bodyVelTextureWrite = bodyVelTextureRead;
  bodyVelTextureRead = tmp;

  // Update body angular velocity
  fullScreenQuad.material = updateBodyVelocityMaterial;
  updateBodyVelocityMaterial.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;
  updateBodyVelocityMaterial.uniforms.invInertia.value = invInertia;
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = bodyAngularVelTextureRead.texture;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = bodyTorqueTexture.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, bodyAngularVelTextureWrite, false );
  updateBodyVelocityMaterial.uniforms.bodyVelTex.value = null;
  updateBodyVelocityMaterial.uniforms.bodyForceTex.value = null;
  updateBodyVelocityMaterial.uniforms.bodyQuatTex.value = null;
  tmp = bodyAngularVelTextureWrite;
  bodyAngularVelTextureWrite = bodyAngularVelTextureRead;
  bodyAngularVelTextureRead = tmp;

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

function initGUI(){
  var controller  = {
    stiffness: params1.x,
    damping: params1.y,
    deltaTime: params2.x,
    friction: params2.y,
    drag: params2.z,
    moreObjects: function(){ location.href = "?n=" + (numParticles*2); },
    lessObjects: function(){ location.href = "?n=" + Math.max(2,numParticles/2); },
    renderParticles: true,
    showBroadphase: false,
    gravity: gravity.y,
  };
  function guiChanged() {
    params1.x = controller.stiffness;
    params1.y = controller.damping;
    params2.x = controller.deltaTime;
    params2.y = controller.friction;
    params2.z = controller.drag;
    gravity.y = controller.gravity;
    if(controller.showBroadphase) scene.add(debugGridMesh); else scene.remove(debugGridMesh);
    if(controller.renderParticles){
      scene.remove(meshMesh);
      scene.add(debugMesh);
    } else {
      scene.remove(debugMesh);
      scene.add(meshMesh);
    }
  }
  var gui = new dat.GUI();
  gui.add( controller, "stiffness", 0, 5000, 0.1 ).onChange( guiChanged );
  gui.add( controller, "damping", 0, 100, 0.1 ).onChange( guiChanged );
  gui.add( controller, "drag", 0, 1, 0.01 ).onChange( guiChanged );
  gui.add( controller, "friction", 0, 10, 0.001 ).onChange( guiChanged );
  gui.add( controller, "deltaTime", 0, 0.1, 0.001 ).onChange( guiChanged );
  gui.add( controller, "gravity", -1, 1, 0.1 ).onChange( guiChanged );
  gui.add( controller, "moreObjects" );
  gui.add( controller, "lessObjects" );
  gui.add( controller, "showBroadphase" ).onChange( guiChanged );
  gui.add( controller, "renderParticles" ).onChange( guiChanged );
  guiChanged();
}
initGUI();

function parseParams(){
  return location.search
    .substr(1)
    .split("&")
    .map(function(pair){
      var a = pair.split("=");
      var o = {};
      o[a[0]] = a[1];
      return o;
    })
    .reduce(function(a,b){
      for(var key in b) a[key] = b[key];
      return a;
    });
}

function calculateSphereInertia(out,mass,radius){
    var I = 2 * mass * radius * radius / 5;
    out.set(I, I, I);
}

function calculateBoxInvInertia(out, mass, extents){
  var c = 1 / 12 * mass;
  out.set(
    1 / (c * ( 2 * extents.y * 2 * extents.y + 2 * extents.z * 2 * extents.z )),
    1 / (c * ( 2 * extents.x * 2 * extents.x + 2 * extents.z * 2 * extents.z )),
    1 / (c * ( 2 * extents.y * 2 * extents.y + 2 * extents.x * 2 * extents.x ))
  );
}