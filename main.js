var numParticles = 64;
var gridResolution = new THREE.Vector3(numParticles/2, numParticles/8, numParticles/2);
var gridPosition = new THREE.Vector3(0.25,0.28,0.25);
var cellSize = new THREE.Vector3(1/numParticles,1/numParticles,1/numParticles);
var radius = cellSize.x * 0.5;
var gravity = new THREE.Vector3(0,-1,0);
var showDebugGrid = true;
var simulationParams1 = new THREE.Vector4(
  2000, // stiffness
  20, // damping
  radius, // radius
  0.3 // drag
);
var simulationParams2 = new THREE.Vector4(
  1/100, // time step
  0, // unused
  0, // unused
  0 // unused
);

var gridPotZ;
var container, controls;
var fullscreenQuadCamera, camera, fullscreenQuadScene, scene, renderer;
var windowHalfX = window.innerWidth / 2, windowHalfY = window.innerHeight / 2;
var posTextureRead, posTextureWrite, velTextureRead, velTextureWrite, gridTexture, forceTexture;
var material, fullScreenQuad, mesh;
var numDebugQuads = 0;
var sceneMap;
var setGridStencilMaterial, setGridStencilMesh;
var texturedMaterial;
var mapParticleMaterial;
var updatePositionMaterial;
var updateVelocityMaterial;
var updateForceMaterial;
var debugQuadPositions;
var debugQuadGrid;
var mapParticleToCellMesh;
var spheresMesh;
var sharedShaderCode;
var dataTex = {};

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
    gridPotZ: 'int(' + gridPotZ + ')'
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

  // Init data textures
  posTextureRead = createRenderTarget(numParticles, numParticles);
  posTextureWrite = createRenderTarget(numParticles, numParticles);
  velTextureRead = createRenderTarget(numParticles, numParticles);
  velTextureWrite = createRenderTarget(numParticles, numParticles);
  forceTexture = createRenderTarget(numParticles, numParticles);
  gridTexture = createRenderTarget(2*gridResolution.x*potSize, 2*gridResolution.y*potSize);

  console.log((numParticles*numParticles) + ' particles');
  console.log('Grid texture is ' + (2*gridResolution.x*potSize) + 'x' + (2*gridResolution.y*potSize));

  // Initial state
  fillRenderTarget(posTextureRead, function(out, x, y){
    out.set( 0.3 + 0.3*Math.random(), 0.1*Math.random() + 0.3, 0.3 + 0.3*Math.random(), 1 );
  });
  fillRenderTarget(velTextureRead, function(out, x, y){
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
  camera.position.set(2,1,2);

  // Create an instanced mesh for spheres
  var sphereGeometry = new THREE.SphereBufferGeometry(radius, 6, 8);
  var triangles = 1;
  var instances = numParticles*numParticles;
  var geometry = new THREE.InstancedBufferGeometry();
  geometry.maxInstancedCount = instances;
  geometry.addAttribute( 'position', sphereGeometry.attributes.position.clone() );
  geometry.addAttribute( 'normal', sphereGeometry.attributes.normal.clone() );
  geometry.addAttribute( 'uv', sphereGeometry.attributes.uv.clone() );
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
  uniforms.posTex = { value: posTextureRead.texture };
  var vert = [
    sharedShaderCode,
    "uniform sampler2D posTex;",
    "attribute float particleIndex;",
    phongShader.vertexShader.replace(
      "<begin_vertex>",
      "<begin_vertex>\nvec2 particleUV=getParticleUV(particleIndex,resolution);transformed.xyz+=texture2D(posTex,particleUV).xyz;"
    )
  ].join('\n');
  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vert,
    fragmentShader: phongShader.fragmentShader,
    lights: true,
    defines: getDefines()
  });
  spheresMesh = new THREE.Mesh( geometry, material );
  spheresMesh.frustumCulled = false;
  scene.add( spheresMesh );

  // debug grid
  if(showDebugGrid){
    addDebugGrid();
  }

  // Init materials
  updatePositionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex:  { value: null },
      velTex:  { value: null },
      params2: { value: simulationParams2 }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updatePositionFrag' ),
    defines: getDefines()
  });

  // Update velocity
  updateVelocityMaterial = new THREE.ShaderMaterial({
    uniforms: {
      forceTex:  { value: forceTexture.texture },
      posTex:  { value: null },
      velTex:  { value: null },
      params2: { value: simulationParams2 }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateVelocityFrag' ),
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
      params1: { value: simulationParams1 },
      params2: { value: simulationParams2 },
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updateForceFrag' ),
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

  // Debug quads
  //debugQuadPositions = addDebugQuad(1, 1);
  //debugQuadGrid = addDebugQuad(gridResolution.z, gridResolution.z, 1/(numParticles*numParticles));

  // Add controls
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.enableZoom = true;
  controls.target.set(0.5, 0.4, 0.5);
}

function createRenderTarget(w,h,format){
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: format === undefined ? THREE.RGBAFormat : format,
    type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
  });
}

function addDebugGrid(){
  var w = gridResolution.x*cellSize.x;
  var h = gridResolution.y*cellSize.y;
  var d = gridResolution.z*cellSize.z;
  var boxGeom = new THREE.BoxGeometry( w, h, d );
  var wireframeMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
  var boxMesh = new THREE.Mesh(boxGeom,wireframeMaterial);
  boxMesh.position.copy(gridPosition);
  boxMesh.position.x += w/2;
  boxMesh.position.y += h/2;
  boxMesh.position.z += d/2;
  scene.add(boxMesh);
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
  if(!dataTex[key]){
    dataTex[key] = new THREE.DataTexture( data, w, h, THREE.RGBAFormat, THREE.FloatType );
  }
  dataTex[key].needsUpdate = true;
  texturedMaterial.uniforms.texture.value = dataTex[key];
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, renderTarget );
  texturedMaterial.uniforms.texture.value = null;
}

function addDebugQuad(sizeX, sizeY, colorScale){
  colorScale = colorScale || 1;
  var geometry = new THREE.PlaneBufferGeometry( sizeX||1, sizeY||1 );
  var mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorScale,colorScale,colorScale) });
  var mesh = new THREE.Mesh( geometry, mat );
  mesh.position.set((numDebugQuads)*1.1, -1, 0);
  numDebugQuads++;
  scene.add( mesh );
  return mesh;
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
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

  // Try drawing a rectangle to the stencil buffer to mask out a square
  var gl = renderer.context;
  var state = renderer.state;

  // Set up the grid texture for stencil routing.
  // See http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf slide 24
  renderer.setClearColor( 0x000000, 1.0 );
  renderer.clearTarget( gridTexture, true, true, true );
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
      var x = i, y = j, r = 0, g = 0, b = 0;
      var stencilValue = i+j*2;
      state.buffers.stencil.setFunc( gl.ALWAYS, stencilValue, 0xffffffff );
      setGridStencilMesh.position.set((x+2)/gridSizeX,(y+2)/gridSizeY,0);
      renderer.render( sceneStencil, fullscreenQuadCamera, gridTexture, false );
    }
  }
  state.buffers.color.setLocked( false );
  state.buffers.color.setMask( true );
  state.buffers.depth.setLocked( false );
  state.buffers.depth.setMask( true );
  state.buffers.stencil.setTest( false );

  // Draw particles to grid, use stencil routing.
  state.buffers.stencil.setTest( true );
  state.buffers.stencil.setFunc( gl.EQUAL, 3, 0xffffffff );
  state.buffers.stencil.setOp( gl.INCR, gl.INCR, gl.INCR ); // Increment stencil value for every rendered fragment
  mapParticleToCellMesh.material = mapParticleMaterial;
  mapParticleMaterial.uniforms.posTex.value = posTextureRead.texture;
  renderer.render( sceneMap, fullscreenQuadCamera, gridTexture, false );
  mapParticleMaterial.uniforms.posTex.value = null;
  state.buffers.stencil.setTest( false );

  // Update forces / collision reaction
  fullScreenQuad.material = updateForceMaterial;
  updateForceMaterial.uniforms.posTex.value = posTextureRead.texture;
  updateForceMaterial.uniforms.velTex.value = velTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, forceTexture, false );
  updateForceMaterial.uniforms.velTex.value = null;
  updateForceMaterial.uniforms.posTex.value = null;

  // Update velocity
  fullScreenQuad.material = updateVelocityMaterial;
  updateVelocityMaterial.uniforms.posTex.value = posTextureRead.texture;
  updateVelocityMaterial.uniforms.velTex.value = velTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, velTextureWrite, false );
  updateVelocityMaterial.uniforms.velTex.value = null;
  updateVelocityMaterial.uniforms.posTex.value = null;
  var tmp = velTextureWrite;
  velTextureWrite = velTextureRead;
  velTextureRead = tmp;

  // Update positions
  fullScreenQuad.material = updatePositionMaterial;
  updatePositionMaterial.uniforms.posTex.value = posTextureRead.texture;
  updatePositionMaterial.uniforms.velTex.value = velTextureRead.texture;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, posTextureWrite, false );
  updatePositionMaterial.uniforms.velTex.value = null;
  updatePositionMaterial.uniforms.posTex.value = null;
  tmp = posTextureWrite; // swap
  posTextureWrite = posTextureRead;
  posTextureRead = tmp;

  // Render main scene
  if(debugQuadPositions) debugQuadPositions.material.map = posTextureRead.texture;
  if(debugQuadGrid) debugQuadGrid.material.map = gridTexture.texture;
  mapParticleMaterial.uniforms.posTex.value = posTextureRead.texture;
  spheresMesh.material.uniforms.posTex.value = posTextureRead.texture;
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x222222, 1.0);
  renderer.clear();
  renderer.render( scene, camera, null, false );
  spheresMesh.material.uniforms.posTex.value = null;
  if(debugQuadPositions) debugQuadPositions.material.map = null;
  if(debugQuadGrid) debugQuadGrid.material.map = null;
}