var scene, light, camera, controls, renderer;
var world;
var particlePositionTexture = new THREE.Texture();
var bodyPositionTexture = new THREE.Texture();
var bodyQuaternionTexture = new THREE.Texture();

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

    var ambientLight = new THREE.AmbientLight( 0x222222 );
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
        maxBodies: 64,
        maxParticles: 64
    });
    for(var i=0; i<world.maxBodies; i++){
        world.addBody(i/world.maxBodies,i/world.maxBodies,i/world.maxBodies, 0,0,0,1);
    }
    for(var i=0; i<world.maxParticles; i++){
        world.addParticle(Math.floor(Math.random()*world.maxBodies), 0,0,0);
    }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

var prevTime;
function animate( time ) {
    requestAnimationFrame( animate );
    var deltaTime = prevTime === undefined ? 0 : (time - prevTime) / 1000;
    world.step( deltaTime );
    prevTime = time;
    render();
}

// Use the native webgl texture in three.js
function updateTexture(threeTexture, webglTexture){
    var properties = renderer.properties.get(threeTexture);
    properties.__webglTexture = webglTexture;
    properties.__webglInit = true;
}

function render() {
    controls.update();

    /*
    // Render main scene
    updateDebugGrid();

    debugMesh.material.uniforms.particleWorldPosTex.value = particlePosWorldTexture.texture;
    debugMesh.material.uniforms.quatTex.value = bodyQuatTextureRead.texture;

    meshMesh.material.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
    meshMesh.material.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;

    meshMesh.customDepthMaterial.uniforms.bodyPosTex.value = bodyPosTextureRead.texture;
    meshMesh.customDepthMaterial.uniforms.bodyQuatTex.value = bodyQuatTextureRead.texture;
    */
    updateTexture(particlePositionTexture, world.particlePositionTexture);
    updateTexture(bodyPositionTexture, world.bodyPositionTexture);
    updateTexture(bodyQuaternionTexture, world.bodyQuaternionTexture);
    groundMesh.material.map = particlePositionTexture;

    renderer.render( scene, camera );

    renderer.resetGLState();
}