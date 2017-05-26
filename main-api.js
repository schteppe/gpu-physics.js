(function(){

var scene, ambientLight, light, camera, controls, renderer;
var world;
var particlePositionTexture = new THREE.Texture();
var bodyPositionTexture = new THREE.Texture();
var bodyQuaternionTexture = new THREE.Texture();
var bodyMassTexture = new THREE.Texture();
var particleForceTexture = new THREE.Texture();
var debugMesh;

var numParticles = 128;
var numBodies = numParticles/2;
var ySpread = 0.1;
var gridResolution = new THREE.Vector3(numParticles/2, numParticles/8, numParticles/2);

var boxSize = new THREE.Vector3(0.25, 1, 0.25);
var gridPosition = new THREE.Vector3(-0.25,0,-0.25);
var cellSize = new THREE.Vector3(1/numParticles,1/numParticles,1/numParticles);
var radius = cellSize.x * 0.5;
var gravity = new THREE.Vector3(0,-0.5,0);

init();
animate();

function init(){
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    var container = document.getElementById( 'container' );
    container.appendChild( renderer.domElement );
    window.addEventListener( 'resize', onWindowResize, false );

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

    camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(0,0.6,1.4);

    var groundMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x000000 } );
    groundMesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), groundMaterial );
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
        context: renderer.context,
        canvas: renderer.domElement,
        maxBodies: numBodies * numBodies,
        maxParticles: numParticles * numParticles,
        radius: radius,
        stiffness: 1700,
        damping: 6,
        fixedTimeStep: 0.1/120,
        friction: 2,
        drag: 0.1
    });
    world.boxSize.copy(boxSize);
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
            var i = particleId - Math.floor(particleId / 4) * 4;
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
        vertexShader: getShader('renderParticlesVertex'),
        fragmentShader: phongShader.fragmentShader,
        lights: true,
        defines: Object.assign({
            USE_MAP: true
        }, world.defines)
    });
    debugMesh = new THREE.Mesh( debugGeometry, debugMaterial );
    debugMesh.frustumCulled = false;
    var checkerTexture = new THREE.DataTexture(new Uint8Array([255,0,0,255, 255,255,255,255]), 2, 1, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping);
    checkerTexture.needsUpdate = true;
    debugMaterial.uniforms.map.value = checkerTexture;
    scene.add(debugMesh);
}

function getShader(id){
  var code = document.getElementById( id ).textContent;
  return sharedShaderCode.innerText + code;
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
}

var prevTime;
function updatePhysics(time){
    var deltaTime = prevTime === undefined ? 0 : (time - prevTime) / 1000;
    world.step( deltaTime );
    prevTime = time;
}

// Use the native webgl texture in three.js
function updateTexture(threeTexture, webglTexture){
    var properties = renderer.properties.get(threeTexture);
    properties.__webglTexture = webglTexture;
    properties.__webglInit = true;
}

function render() {
    controls.update();

    updateTexture(particlePositionTexture, world.particlePositionTexture);
    updateTexture(bodyPositionTexture, world.bodyPositionTexture);
    updateTexture(bodyQuaternionTexture, world.bodyQuaternionTexture);
    updateTexture(bodyMassTexture, world.bodyMassTexture);
    updateTexture(particleForceTexture, world.particleForceTexture);

    /*
    // Render main scene
    updateDebugGrid();
    */
    /*
    meshMesh.material.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
    meshMesh.material.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;

    meshMesh.customDepthMaterial.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
    meshMesh.customDepthMaterial.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;*/

    renderer.resetGLState();

    renderer.setClearColor(ambientLight.color, 1.0);

    groundMesh.material.map = particleForceTexture;
    debugMesh.material.uniforms.particleWorldPosTex.value = particlePositionTexture;
    debugMesh.material.uniforms.quatTex.value = bodyQuaternionTexture;

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

})();