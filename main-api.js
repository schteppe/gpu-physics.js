(function(){

var scene, ambientLight, light, camera, controls, renderer;
var world;
var debugMesh, debugGridMesh;
var controller;

var ySpread = 0.1;
var query = parseParams();
var numParticles = query.n ? parseInt(query.n,10) : 64;
var gridResolution = new THREE.Vector3();
switch(numParticles){
    case 64:
        gridResolution.set(numParticles/2, numParticles/8, numParticles/2);
        break;
    case 128:
        gridResolution.set(numParticles/2, numParticles/16, numParticles/2);
        break;
    case 256:
        gridResolution.set(numParticles/2, numParticles/32, numParticles/2);
        ySpread = 0.05;
        break;
    case 512:
        gridResolution.set(numParticles/2, numParticles/64, numParticles/2);
        ySpread = 0.01;
        break;
    case 1024:
        gridResolution.set(numParticles/2, numParticles/64, numParticles/2);
        ySpread = 0.001;
        break;
    default:
        throw new Error("Invalid value of parameter 'n'.");
}
var numBodies = numParticles / 2;
var radius = 1/numParticles * 0.5;
var boxSize = new THREE.Vector3(0.25, 1, 0.25);

init();
animate();

function init(){
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( 1 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    var container = document.getElementById( 'container' );
    container.appendChild( renderer.domElement );
    window.addEventListener( 'resize', onWindowResize, false );

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );

    scene = new THREE.Scene();

    light = new THREE.DirectionalLight();
    light.castShadow = true;
    light.shadow.mapSize.width = light.shadow.mapSize.height = 1024;
    var d = 0.5;
    light.shadow.camera.left = - d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = - d;
    light.shadow.camera.far = 100;
    light.position.set(1,1,1);
    scene.add(light);

    ambientLight = new THREE.AmbientLight( 0x222222 );
    scene.add( ambientLight );

    camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.01, 100 );
    camera.position.set(0,0.6,1.4);

    var groundMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x000000 } );
    groundMesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2000, 2000 ), groundMaterial );
    groundMesh.rotation.x = - Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add( groundMesh );

    // Add controls
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.enableZoom = true;
    controls.target.set(0.0, 0.1, 0.0);
    controls.maxPolarAngle = Math.PI * 0.5;

    // Physics
    world = new World({
        gravity: new THREE.Vector3(0,-1,0),
        renderer: renderer,
        maxBodies: numBodies * numBodies,
        maxParticles: numParticles * numParticles,
        radius: radius,
        stiffness: 1700,
        damping: 6,
        fixedTimeStep: 1/120,
        friction: 2,
        drag: 0.3,
        boxSize: boxSize,
        gridPosition: new THREE.Vector3(-boxSize.x,0,-boxSize.z),
        gridResolution: gridResolution
    });

    world.setSphereRadius(0, 0.05);
    world.setSpherePosition(0, 0,0,0);

    // Add bodies
    for(var bodyId=0; bodyId<world.maxBodies; bodyId++){
        var x = -boxSize.x + 2*boxSize.x*Math.random();
        var y = ySpread*Math.random();
        var z = -boxSize.z + 2*boxSize.z*Math.random();

        var q = new THREE.Quaternion();
        var axis = new THREE.Vector3(
            Math.random()-0.5,
            Math.random()-0.5,
            Math.random()-0.5
        );
        axis.normalize();
        q.setFromAxisAngle(axis, Math.random() * Math.PI * 2);

        var invMassProps = new THREE.Vector3();
        var mass = 1;
        if(bodyId < world.maxBodies / 2){
            calculateBoxInvInertia(invMassProps, mass, new THREE.Vector3(radius*2*4,radius*2,radius*2));
        } else {
            calculateBoxInvInertia(invMassProps, mass, new THREE.Vector3(radius*4,radius*4,radius*2));
        }
        world.addBody(x,y,z, q.x, q.y, q.z, q.w, mass, 1/invMassProps.x, 1/invMassProps.y, 1/invMassProps.z);
    }

    // Add particles to bodies
    for(var particleId=0; particleId<world.maxParticles; ++particleId){
        var bodyId = Math.floor(particleId / 4);
        var x=0, y=0; z=0;

        if(bodyId < world.maxBodies / 2){
            x = (particleId % 4 - 1.5) * radius * 2.01;
        } else {
            var i = particleId - bodyId * 4;
            x = ((i % 2)-0.5) * radius * 2.01;
            y = (Math.floor(i / 2)-0.5) * radius * 2.01;
        }

        world.addParticle(bodyId, x,y,z);
    }

    // Create an instanced mesh for debug spheres
    var sphereGeometry = new THREE.SphereBufferGeometry(world.radius, 8, 8);
    var instances = world.maxParticles;
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
        vertexShader: sharedShaderCode2.innerText + renderParticlesVertex.innerText,
        fragmentShader: phongShader.fragmentShader,
        lights: true,
        defines: {
            USE_MAP: true,
            bodyTextureResolution: 'vec2(' + world.bodyTextureSize.toFixed(1) + ',' + world.bodyTextureSize.toFixed(1) + ')',
            resolution: 'vec2(' + world.particleTextureSize.toFixed(1) + ',' + world.particleTextureSize.toFixed(1) + ')'
        }
    });
    debugMesh = new THREE.Mesh( debugGeometry, debugMaterial );
    debugMesh.frustumCulled = false;
    var checkerTexture = new THREE.DataTexture(new Uint8Array([255,0,0,255, 255,255,255,255]), 2, 1, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping);
    checkerTexture.needsUpdate = true;
    debugMaterial.uniforms.map.value = checkerTexture;
    //scene.add(debugMesh);

    initDebugGrid();

    // Create an instanced mesh for cylinders
    var cylinderGeometry = new THREE.CylinderBufferGeometry(radius, radius, 2*4*radius, 8);
    cylinderGeometry.rotateZ(Math.PI / 2);// particles are spread along x, not y
    var bodyInstances = numBodies*numBodies / 2;
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

    // Create an instanced mesh for boxes
    var boxGeometry = new THREE.BoxBufferGeometry(4*radius, 4*radius, 2*radius, 8);
    var bodyInstances = numBodies*numBodies / 2;
    var boxMeshGeometry = new THREE.InstancedBufferGeometry();
    boxMeshGeometry.maxInstancedCount = bodyInstances;
    for(var attributeName in boxGeometry.attributes){
        boxMeshGeometry.addAttribute( attributeName, boxGeometry.attributes[attributeName].clone() );
    }
    boxMeshGeometry.setIndex( boxGeometry.index.clone() );
    var bodyIndices2 = new THREE.InstancedBufferAttribute( new Float32Array( bodyInstances * 1 ), 1, 1 );
    for ( var i = 0, ul = bodyIndices2.count; i < ul; i++ ) {
        bodyIndices2.setX( i, i + numBodies*numBodies / 2 ); // one index per instance
    }
    boxMeshGeometry.addAttribute( 'bodyIndex', bodyIndices2 );
    boxMeshGeometry.boundingSphere = null;

    // Mesh material - extend the phong shader
    var meshUniforms = THREE.UniformsUtils.clone(phongShader.uniforms);
    meshUniforms.bodyQuatTex = { value: null };
    meshUniforms.bodyPosTex = { value: null };
    var meshMaterial = new THREE.ShaderMaterial({
        uniforms: meshUniforms,
        vertexShader: sharedShaderCode2.innerText + renderBodiesVertex.innerText,
        fragmentShader: phongShader.fragmentShader,
        lights: true,
        defines: {
            bodyTextureResolution: 'vec2(' + world.bodyTextureSize.toFixed(1) + ',' + world.bodyTextureSize.toFixed(1) + ')',
            resolution: 'vec2(' + world.particleTextureSize.toFixed(1) + ',' + world.particleTextureSize.toFixed(1) + ')'
        }
    });
    meshMesh = new THREE.Mesh( meshGeometry, meshMaterial );
    meshMesh.frustumCulled = false; // Instances can't be culled like normal meshes
    // Create a depth material for rendering instances to shadow map
    meshMesh.customDepthMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.ShaderLib.depth.uniforms,
            meshUniforms
        ]),
        vertexShader: sharedShaderCode2.innerText + renderBodiesDepth.innerText,
        fragmentShader: THREE.ShaderLib.depth.fragmentShader,
        defines: {
            DEPTH_PACKING: 3201,
            bodyTextureResolution: 'vec2(' + world.bodyTextureSize.toFixed(1) + ',' + world.bodyTextureSize.toFixed(1) + ')',
            resolution: 'vec2(' + world.particleTextureSize.toFixed(1) + ',' + world.particleTextureSize.toFixed(1) + ')'
        }
    });
    meshMesh.castShadow = true;
    meshMesh.receiveShadow = true;
    scene.add( meshMesh );

    meshMesh2 = new THREE.Mesh( boxMeshGeometry, meshMaterial );
    meshMesh2.customDepthMaterial = meshMesh.customDepthMaterial;
    meshMesh2.frustumCulled = false; // Instances can't be culled like normal meshes
    meshMesh2.castShadow = true;
    meshMesh2.receiveShadow = true;
    scene.add( meshMesh2 );

    // interaction
    interactionSphereMesh = new THREE.Mesh(new THREE.SphereBufferGeometry(1,16,16), new THREE.MeshPhongMaterial({ color: 0xffffff }));
    scene.add(interactionSphereMesh);
    gizmo = new THREE.TransformControls( camera, renderer.domElement );
    gizmo.addEventListener( 'change', function(){
        if(this.object === interactionSphereMesh){
            world.setSpherePosition(
                0,
                interactionSphereMesh.position.x,
                interactionSphereMesh.position.y,
                interactionSphereMesh.position.z
            );
        } else if(this.object === debugGridMesh){
            world.broadphase.position.copy(debugGridMesh.position);
        }
    });
    scene.add(gizmo);
    gizmo.attach(interactionSphereMesh);
    interactionSphereMesh.castShadow = true;
    interactionSphereMesh.receiveShadow = true;

    initGUI();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate( time ) {
    requestAnimationFrame( animate );
    updatePhysics( time );
    render();
    stats.update();
}

var prevTime;
function updatePhysics(time){
    var deltaTime = prevTime === undefined ? 0 : (time - prevTime) / 1000;
    if(!controller.paused){
        if( controller.interaction === 'none') {
            // Animate sphere
            var introSweepPos = Math.max(0, 1 - world.fixedTime);
            var x = 0.12*Math.sin(2 * 1.9 * world.fixedTime);
            var y = 0.05*(Math.cos(2 * 2 * world.fixedTime)+0.5) + introSweepPos;
            var z = 0.12*Math.cos(2 * 2.1 * world.fixedTime) + introSweepPos;
            interactionSphereMesh.position.set( x, y, z );
            world.setSpherePosition( 0, x, y, z );
        }
        world.step( deltaTime );
    }
    prevTime = time;
}

function initDebugGrid(){
  var w = world.broadphase.resolution.x * world.radius * 2;
  var h = world.broadphase.resolution.y * world.radius * 2;
  var d = world.broadphase.resolution.z * world.radius * 2;
  var boxGeom = new THREE.BoxGeometry( w, h, d );
  var wireframeMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
  debugGridMesh = new THREE.Object3D();
  var mesh = new THREE.Mesh(boxGeom,wireframeMaterial);
  debugGridMesh.add(mesh);
  debugGridMesh.position.copy(world.broadphase.position);
  mesh.position.set(w/2, h/2, d/2);
  scene.add(debugGridMesh);
}

function updateDebugGrid(){
  debugGridMesh.position.copy(world.broadphase.position);
}

function render() {
    controls.update();

    // Render main scene
    updateDebugGrid();

    meshMesh.material.uniforms.bodyPosTex.value = world.bodyPositionTexture;
    meshMesh.material.uniforms.bodyQuatTex.value = world.bodyQuaternionTexture;

    meshMesh.customDepthMaterial.uniforms.bodyPosTex.value = world.bodyPositionTexture;
    meshMesh.customDepthMaterial.uniforms.bodyQuatTex.value = world.bodyQuaternionTexture;

    renderer.setClearColor(ambientLight.color, 1.0);

    //groundMesh.material.map = world.particleForceTexture;
    debugMesh.material.uniforms.particleWorldPosTex.value = world.particlePositionTexture;
    debugMesh.material.uniforms.quatTex.value = world.bodyQuaternionTexture;

    renderer.clear();
    renderer.render( scene, camera );

    debugMesh.material.uniforms.particleWorldPosTex.value = null;
    debugMesh.material.uniforms.quatTex.value = null;
}

function calculateBoxInvInertia(out, mass, extents){
  var c = 1 / 12 * mass;
  out.set(
    1 / (c * ( 2 * extents.y * 2 * extents.y + 2 * extents.z * 2 * extents.z )),
    1 / (c * ( 2 * extents.x * 2 * extents.x + 2 * extents.z * 2 * extents.z )),
    1 / (c * ( 2 * extents.y * 2 * extents.y + 2 * extents.x * 2 * extents.x ))
  );
}

function initGUI(){
  controller  = {
    moreObjects: function(){ location.href = "?n=" + (numParticles*2); },
    lessObjects: function(){ location.href = "?n=" + Math.max(2,numParticles/2); },
    paused: false,
    renderParticles: false,
    renderShadows: true,
    gravity: world.gravity.y,
    interaction: 'none',
    sphereRadius: world.getSphereRadius(0)
  };
  function guiChanged() {
    world.gravity.y = controller.gravity;
    if(controller.interaction === 'broadphase') scene.add(debugGridMesh); else scene.remove(debugGridMesh);
    if(controller.renderParticles){
      scene.remove(meshMesh);
      scene.remove(meshMesh2);
      scene.add(debugMesh);
    } else {
      scene.remove(debugMesh);
      scene.add(meshMesh);
      scene.add(meshMesh2);
    }
    if(controller.renderShadows){
      renderer.shadowMap.autoUpdate = true;
    } else {
      renderer.clearTarget(light.shadow.map);
      renderer.shadowMap.autoUpdate = false;
    }
    gizmo.detach(gizmo.object);
    switch(controller.interaction){
      case 'sphere':
        gizmo.attach(interactionSphereMesh);
        break;
      case 'broadphase':
        gizmo.attach(debugGridMesh);
        break;
    }
    var r = controller.sphereRadius;
    interactionSphereMesh.scale.set(r,r,r);
    world.setSphereRadius(0,r);
  }
  gui = new dat.GUI();
  gui.add( world, "stiffness", 0, 5000, 0.1 );
  gui.add( world, "damping", 0, 100, 0.1 );
  gui.add( world, "drag", 0, 1, 0.01 );
  gui.add( world, "friction", 0, 10, 0.001 );
  gui.add( world, "fixedTimeStep", 0, 0.1, 0.001 );
  gui.add( controller, "paused" ).onChange( guiChanged );
  gui.add( controller, "gravity", -1, 1, 0.1 ).onChange( guiChanged );
  gui.add( controller, "moreObjects" );
  gui.add( controller, "lessObjects" );
  gui.add( controller, "renderParticles" ).onChange( guiChanged );
  gui.add( controller, "renderShadows" ).onChange( guiChanged );
  gui.add( controller, 'interaction', [ 'none', 'sphere', 'broadphase' ] ).onChange( guiChanged );
  gui.add( controller, 'sphereRadius', boxSize.x/10, boxSize.x/2 ).onChange( guiChanged );
  guiChanged();

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  document.addEventListener('click', function( event ) {
      mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
      mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;
      raycaster.setFromCamera( mouse, camera );
      var intersects = raycaster.intersectObjects( [interactionSphereMesh] );
      if ( intersects.length > 0 ) {
          controller.interaction = 'sphere';
          gui.updateDisplay();
          guiChanged();
      }
  });
}

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

})();