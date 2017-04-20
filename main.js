var numParticles = 2;
var deltaTime = 1 / 60;
var stiffness = 1500;
var damping = 10;
var gridResolution = new THREE.Vector3(1*numParticles, 1*numParticles, 1*numParticles);
var gridPosition = new THREE.Vector3(0,0,0);
var cellSize = new THREE.Vector3(1/numParticles,1/numParticles,1/numParticles);
var radius = cellSize.x * 0.5;
var gravity = new THREE.Vector3(0,0,0);

var container, controls;
var fullscreenQuadCamera, camera, fullscreenQuadScene, sceneTestQuad, scene, renderer, material2;
var windowHalfX = window.innerWidth / 2, windowHalfY = window.innerHeight / 2;
var mouseX = 0, mouseY = 0;
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

init();
animate();

function getShader(id){
  var code = document.getElementById( id ).textContent;
  var sharedCode = document.getElementById( 'sharedShaderCode' ).textContent;
  return sharedCode + code;
}

function getDefines(){
  return {
    resolution: 'vec2( ' + numParticles.toFixed( 1 ) + ', ' + numParticles.toFixed( 1 ) + " )",
    gridResolution: (
      'vec3( ' + gridResolution.x.toFixed( 1 ) + ', ' + gridResolution.y.toFixed( 1 ) + ', ' + gridResolution.z.toFixed( 1 ) + " )"
    )
  };
}

function init() {
  container = document.getElementById( 'container' );

  // Set up renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( 1/*window.devicePixelRatio*/ ); // For some reason, device pixel ratio messes up the rendertargets on mobile
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.autoClear = false;
  container.appendChild( renderer.domElement );
  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
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
  function createRenderTarget(w,h){
    return new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType
    });
  }
  posTextureRead = createRenderTarget(numParticles, numParticles);
  posTextureWrite = createRenderTarget(numParticles, numParticles);
  velTextureRead = createRenderTarget(numParticles, numParticles);
  velTextureWrite = createRenderTarget(numParticles, numParticles);
  forceTexture = createRenderTarget(numParticles, numParticles);

  // Compute upper closest power of 2 for the grid texture size in z
  var potSize = 1;
  while(potSize*potSize < gridResolution.z){
    potSize *= 2;
  }
  gridResolution.z = potSize*potSize;
  gridTexture = createRenderTarget(2*gridResolution.x*potSize, 2*gridResolution.y*potSize);

  // Initial state
  setInitialState(numParticles, posTextureRead, velTextureRead);

  // main 3D scene
  scene = new THREE.Scene();
  var light = new THREE.DirectionalLight();
  light.position.set(10,10,20);
  scene.add(light);
  camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, .1, 10000 );
  camera.position.set(2,0,15);
  var backgroundGeometry = new THREE.PlaneBufferGeometry( 100, 100 );
  backgroundMaterial = new THREE.MeshBasicMaterial( { color: 0x222222 } );
  var backgroundMesh = new THREE.Mesh( backgroundGeometry, backgroundMaterial );
  backgroundMesh.position.z = -3;
  scene.add( backgroundMesh );

  // Renders meshes at position given by a texture
  var phongShader = THREE.ShaderLib.phong;
  var uniforms = THREE.UniformsUtils.clone(phongShader.uniforms);
  uniforms.posTex = { value: null };
  uniforms.particleIndex = { value: 0 };
  var sphereGeometry = new THREE.SphereGeometry(radius,16,16);
  var vert = document.getElementById( 'sharedShaderCode' ).textContent + "uniform sampler2D posTex;uniform float particleIndex;\n"+phongShader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvec2 particleUV=getParticleUV(particleIndex,resolution);transformed.xyz+=texture2D(posTex,particleUV).xyz;");
  var def = getDefines();
  var beforeRender = function(renderer, scene, camera, geometry, material){
    material.uniforms.particleIndex.value = this.particleIndex;
    material.uniforms.posTex.value = posTextureRead.texture;
  };
  var afterRender = function(renderer, scene, camera, geometry, material){
    material.uniforms.posTex.value = null;
  };
  for(var i=0; i<numParticles*numParticles; i++){
    var renderParticleMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vert,
      fragmentShader: phongShader.fragmentShader,
      lights: true,
      defines: def
    });
    var sphereMesh = new THREE.Mesh( sphereGeometry, renderParticleMaterial );
    sphereMesh.particleIndex = i;
    sphereMesh.onBeforeRender = beforeRender;
    sphereMesh.onAfterRender = afterRender;
    scene.add(sphereMesh);
  }

  for(var i=0; i<gridResolution.x; i++){
    for(var j=0; j<gridResolution.y; j++){
      for(var k=0; k<gridResolution.z; k++){
        var boxGeom = new THREE.BoxGeometry(1,1,1);
        var wireframeMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
        var boxMesh = new THREE.Mesh(boxGeom,wireframeMaterial);
        boxMesh.position.copy(gridPosition);
        boxMesh.position.add(cellSize.clone().multiply(new THREE.Vector3(i,j,k)));
        boxMesh.position.add(cellSize.clone().multiplyScalar(0.5));
        boxMesh.scale.copy(cellSize);
        scene.add(boxMesh);
      }
    }
  }
  // Init materials
  updatePositionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex:  { value: null },
      velTex:  { value: null },
      deltaTime: { value: deltaTime }
    },
    vertexShader: getShader( 'vertexShader' ),
    fragmentShader: getShader( 'updatePositionFrag' ),
    defines: getDefines()
  });

  // Update velocity
  updateVelocityMaterial = new THREE.ShaderMaterial({
    uniforms: {
      forceTex:  { value: null },
      posTex:  { value: null },
      velTex:  { value: null },
      deltaTime: { value: deltaTime }
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
      gridTex:  { value: null },
      deltaTime: { value: deltaTime },
      gravity: { value: gravity },
      stiffness: { value: stiffness },
      damping: { value: damping },
      radius: { value: radius },
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
  debugQuadPositions = addDebugQuad(1, 1);
  debugQuadGrid = addDebugQuad(gridResolution.z, gridResolution.z, 1/(numParticles*numParticles));

  // Add controls
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.enableZoom = true;
}

function setInitialState(size, posTex, velTex){
  // Position
  var data = new Float32Array(size*size*4);
  for(var i=0; i<size; i++){
    for(var j=0; j<size; j++){
      var p = (i*size + j) * 4;
      var x,y,z;

      switch(1){
        case 0:
          x = radius;//(i%2) * radius * 3;//0.2+Math.random()*0.6;//radius + (i%2) * radius * 3;//Math.random();//10*radius + (i%2) * radius * 3;
          y = radius;//radius + j*radius*2.4;//0.2+Math.random()*0.2;//radius + j*radius*2.4;//Math.random();//2*radius + j*radius*2.4;
          z = radius;//radius + (i%2) * radius * 3;//0.2+Math.random()*0.6;//radius + (i%2) * radius * 3;//Math.random();//10*radius + (i%2) * radius * 3;
          break;
        case 1:
          x = Math.random();
          y = Math.random();
          z = Math.random();
          break;
      }

      data[p + 0] = x;
      data[p + 1] = y;
      data[p + 2] = z;
      data[p + 3] = 1; // to make it easier to debug
    }
  }
  dataTex = new THREE.DataTexture( data, size, size, THREE.RGBAFormat, THREE.FloatType );
  dataTex.needsUpdate = true;
  texturedMaterial.uniforms.texture.value = dataTex;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, posTex );
  texturedMaterial.uniforms.texture.value = null;

  // Set velocity
  var data2 = new Float32Array(size*size*4);
  for(var i=0; i<size; i++){
    for(var j=0; j<size; j++){
      var p = (i*size + j) * 4;
      data2[p + 0] = 0;//(Math.random()-0.5)*0.2;
      data2[p + 1] = 0;//(Math.random()-0.5)*0.2;
      data2[p + 2] = 0;//(Math.random()-0.5)*0.2;
      data2[p + 3] = 1; // to make it easier to debug
    }
  }
  var dataTex2 = new THREE.DataTexture( data2, size, size, THREE.RGBAFormat, THREE.FloatType );
  dataTex2.needsUpdate = true;
  texturedMaterial.uniforms.texture.value = dataTex2;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, velTex );
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

function onDocumentMouseMove( event ) {
  mouseX = ( event.clientX - windowHalfX );
  mouseY = ( event.clientY - windowHalfY );
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
  renderer.clearTarget( gridTexture, true, true, true );
  state.buffers.depth.setMask( false ); // dont draw depth
  state.buffers.color.setMask( false ); // dont draw color
  state.buffers.color.setLocked( true );
  state.buffers.depth.setLocked( true );
  state.buffers.stencil.setTest( true );
  state.buffers.stencil.setOp( gl.REPLACE, gl.REPLACE, gl.REPLACE );
  state.buffers.stencil.setClear( 0 );
  for(var i=0;i<2;i++){
    for(var j=0;j<2;j++){
      var x = i, y = j, r = 0, g = 0, b = 0;
      var stencilValue = i+j*2;
      state.buffers.stencil.setFunc( gl.ALWAYS, stencilValue, 0xffffffff );
      setGridStencilMaterial.color.setRGB(1,1,1);
      var gridSizeX = gridTexture.width;
      var gridSizeY = gridTexture.height;
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
  state.buffers.stencil.setOp( gl.INCR, gl.INCR, gl.INCR );
  mapParticleToCellMesh.material = mapParticleMaterial;
  mapParticleMaterial.uniforms.posTex.value = posTextureRead.texture;
  renderer.render( sceneMap, fullscreenQuadCamera, gridTexture, false );
  mapParticleMaterial.uniforms.posTex.value = null;
  state.buffers.stencil.setTest( false );

  // Update forces / collision reaction
  fullScreenQuad.material = updateForceMaterial;
  updateForceMaterial.uniforms.posTex.value = posTextureRead.texture;
  updateForceMaterial.uniforms.velTex.value = velTextureRead.texture;
  updateForceMaterial.uniforms.gridTex.value = gridTexture.texture;
  updateForceMaterial.uniforms.deltaTime.value = deltaTime;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, forceTexture, false );
  updateForceMaterial.uniforms.velTex.value = null;
  updateForceMaterial.uniforms.posTex.value = null;
  updateForceMaterial.uniforms.gridTex.value = null;

  // Update velocity
  fullScreenQuad.material = updateVelocityMaterial;
  updateVelocityMaterial.uniforms.posTex.value = posTextureRead.texture;
  updateVelocityMaterial.uniforms.velTex.value = velTextureRead.texture;
  updateVelocityMaterial.uniforms.forceTex.value = forceTexture.texture;
  updateVelocityMaterial.uniforms.deltaTime.value = deltaTime;
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
  updatePositionMaterial.uniforms.deltaTime.value = deltaTime;
  renderer.render( fullscreenQuadScene, fullscreenQuadCamera, posTextureWrite, false );
  updatePositionMaterial.uniforms.velTex.value = null;
  updatePositionMaterial.uniforms.posTex.value = null;
  tmp = posTextureWrite; // swap
  posTextureWrite = posTextureRead;
  posTextureRead = tmp;

  // Render main scene
  debugQuadPositions.material.map = posTextureRead.texture;
  debugQuadGrid.material.map = gridTexture.texture;
  mapParticleMaterial.uniforms.posTex.value = posTextureRead.texture;
  renderer.render( scene, camera );
  debugQuadPositions.material.map = null;
  debugQuadGrid.material.map = null;
}






// "Unit testing" the shaders...
function gridPosToGridUV(gridPos, subIndex, gridRes){
     // Keep within limits
     gridPos.set(
      clamp(gridPos.x, 0, gridRes.x-1),
      clamp(gridPos.y, 0, gridRes.y-1),
      clamp(gridPos.z, 0, gridRes.z-1)
    );

    //vec3 gridTexRes = 2.0 * gridRes.xy * vec2(1, gridRes.z);
    var gridTexRes = new THREE.Vector2(
      2 * gridRes.x * 1,
      2 * gridRes.y * gridRes.z
    );
    //vec2 gridUV = 2.0 * gridPos.xy / gridTexRes;
    var gridUV = new THREE.Vector2(
      2*gridPos.x / gridTexRes.x,
      2*gridPos.y / gridTexRes.y
    );
    //gridUV.y += gridPos.z / gridRes.z; // Move up to correct z section
    gridUV.y += gridPos.z / gridRes.z;
    // Choose sub pixel
    //float fSubIndex = float(subIndex);
    var fSubIndex = subIndex;
    //gridUV += 2.0*vec2(mod(fSubIndex,2.0), fSubIndex/2.0) / gridTexRes;
    gridUV.add(new THREE.Vector2(
      mod(fSubIndex,2.0) / gridTexRes.x,
      fSubIndex/2.0 / gridTexRes.y
    ));
    //gridUV += vec2(1)/gridTexRes; // Move to center of pixel
    //gridUV.add(new THREE.Vector2(1/gridTexRes.x,1/gridTexRes.y)); // Move to center of pixel
    return gridUV;
}
// TEST 2, using square broadphase texture
function gridPosToGridUVSquare(gridPos, subIndex, gridRes){
     // Keep within grid
     gridPos.set(
      clamp(gridPos.x, 0, gridRes.x-1),
      clamp(gridPos.y, 0, gridRes.y-1),
      clamp(gridPos.z, 0, gridRes.z-1)
    );

    // Compute upper closest power of 2 for the grid texture
    // Should be precomputed?
    var potSize = 1;
    while(potSize*potSize < gridRes.z){
      potSize *= 2;
    }

    var gridTexRes = new THREE.Vector2(
      2 * gridRes.x * potSize,
      2 * gridRes.y * potSize
    );
    var gridUV = new THREE.Vector2(
      2*gridPos.x / gridTexRes.x,
      2*gridPos.y / gridTexRes.y
    );
    // move to correct z square
    var zPos = new THREE.Vector2(
      mod(gridPos.z, potSize),
      floor(gridPos.z / potSize)
    );
    zPos.divide(new THREE.Vector2(potSize,potSize));
    gridUV.add(zPos);

    // Choose sub pixel
    var fSubIndex = subIndex;
    gridUV.add(new THREE.Vector2(
      mod(fSubIndex,2.0) / gridTexRes.x,
      floor(fSubIndex/2.0) / gridTexRes.y
    ));
    return gridUV;
}
function clamp(x,min,max){
  return Math.max(Math.min(x,max), min);
}
function floor(x){
  return Math.floor(x);
}
function mod(x,n){
  return  ((x%n)+n)%n;
}

// position texture is 2x2 pixels
// grid texture is 4x8 pixels
var gridPos = new THREE.Vector3(0,0,0);
var gridRes = new THREE.Vector3(2,2,2);
var result = gridPosToGridUV(gridPos, 0, gridRes);
//console.log(result.equals(new THREE.Vector2(0.25, 0.125)));

gridPos.set(0,0,0);
gridRes.set(2,2,2);
result.copy( gridPosToGridUV(gridPos, 1, gridRes) );
//console.log(result/*.equals(new THREE.Vector2(0.5, 0.125))*/);


// TEST 2, using square broadphase texture
gridPos.set(0,0,0);
gridRes.set(8,8,8);
// This will create 4x4 cells (closest upper power of 2) for different z positions, only using the 8 first.
// Each z-cell is 16x16, a total size of 64x64 in the broadphase texture
result = gridPosToGridUVSquare(gridPos, 0, gridRes);
console.log(result.equals(new THREE.Vector2(0,0)));

gridPos.set(0,0,1);
result = gridPosToGridUVSquare(gridPos, 0, gridRes);
console.log(result.equals(new THREE.Vector2(1/4,0)));

gridPos.set(1,0,1);
result = gridPosToGridUVSquare(gridPos, 0, gridRes);
console.log(result.equals(new THREE.Vector2(1/4 + (1/8) * 1/4,0)));

gridPos.set(0,0,4);
result = gridPosToGridUVSquare(gridPos, 0, gridRes);
console.log(result.equals(new THREE.Vector2(0,1/4)));

gridPos.set(0,0,7);
result = gridPosToGridUVSquare(gridPos, 0, gridRes);
console.log(result.equals(new THREE.Vector2(3/4,1/4)));

gridPos.set(0,0,7);
result = gridPosToGridUVSquare(gridPos, 3, gridRes);
console.log(result.equals(new THREE.Vector2(3/4 + 1/64,1/4 + 1/64)));
