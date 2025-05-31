(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three')) :
	typeof define === 'function' && define.amd ? define(['three'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Demo = factory(global.THREE));
})(this, (function (THREE) { 'use strict';

	function _interopNamespaceDefault(e) {
		var n = Object.create(null);
		if (e) {
			Object.keys(e).forEach(function (k) {
				if (k !== 'default') {
					var d = Object.getOwnPropertyDescriptor(e, k);
					Object.defineProperty(n, k, d.get ? d : {
						enumerable: true,
						get: function () { return e[k]; }
					});
				}
			});
		}
		n.default = e;
		return Object.freeze(n);
	}

	var THREE__namespace = /*#__PURE__*/_interopNamespaceDefault(THREE);

	var shared = "int uvToIndex(vec2 uv, vec2 size) {\n\tivec2 coord = ivec2(floor(uv*size+0.5));\n\treturn coord.x + int(size.x) * coord.y;\n}\nvec2 indexToUV(float index, vec2 res){\n\tvec2 uv = vec2(mod(index/res.x,1.0), floor( index/res.y ) / res.x);\n\treturn uv;\n}\nvec3 worldPosToGridPos(vec3 particlePos, vec3 gridPos, vec3 cellSize){\n\treturn floor((particlePos - gridPos)/cellSize);\n}\nvec2 gridPosToGridUV(vec3 gridPos, int subIndex, vec3 gridRes, vec2 gridTextureRes, vec2 gridZTile){\n\tgridPos = clamp(gridPos, vec3(0), gridRes-vec3(1));\n\tvec2 gridUV = 2.0 * gridPos.xz / gridTextureRes;\n\tvec2 zPos = vec2( mod(gridPos.y, gridZTile.x), floor(gridPos.y / gridZTile.y) );\n\tzPos /= gridZTile;\n\tgridUV += zPos;\n\tfloat fSubIndex = float(subIndex);\n\tgridUV += vec2( mod(fSubIndex,2.0), floor(fSubIndex/2.0) ) / gridTextureRes;\n\treturn gridUV;\n}\nvec4 quat_integrate(vec4 q, vec3 w, float dt){\n\tfloat half_dt = dt * 0.5;\n\tq.x += half_dt * (w.x * q.w + w.y * q.z - w.z * q.y);\tq.y += half_dt * (w.y * q.w + w.z * q.x - w.x * q.z);\n\tq.z += half_dt * (w.z * q.w + w.x * q.y - w.y * q.x);\n\tq.w += half_dt * (- w.x * q.x - w.y * q.y - w.z * q.z);\n\treturn normalize(q);\n}\nvec3 vec3_applyQuat(vec3 v, vec4 q){\n\tfloat ix =  q.w * v.x + q.y * v.z - q.z * v.y;\tfloat iy =  q.w * v.y + q.z * v.x - q.x * v.z;\n\tfloat iz =  q.w * v.z + q.x * v.y - q.y * v.x;\n\tfloat iw = -q.x * v.x - q.y * v.y - q.z * v.z;\n\treturn vec3(\n\t\tix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,\n\t\tiy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,\n\t\tiz * q.w + iw * -q.z + ix * -q.y - iy * -q.x\n\t);\n}\nmat3 transpose2( const in mat3 v ) {\n\tmat3 tmp;\n\ttmp[0] = vec3(v[0].x, v[1].x, v[2].x);\n\ttmp[1] = vec3(v[0].y, v[1].y, v[2].y);\n\ttmp[2] = vec3(v[0].z, v[1].z, v[2].z);\n\treturn tmp;\n}\nmat3 quat2mat(vec4 q){\n\tfloat x = q.x;\n\tfloat y = q.y;\n\tfloat z = q.z;\n\tfloat w = q.w;\n\tfloat x2 = x + x;\n\tfloat y2 = y + y;\n\tfloat z2 = z + z;\n\tfloat xx = x * x2;\n\tfloat xy = x * y2;\n\tfloat xz = x * z2;\n\tfloat yy = y * y2;\n\tfloat yz = y * z2;\n\tfloat zz = z * z2;\n\tfloat wx = w * x2;\n\tfloat wy = w * y2;\n\tfloat wz = w * z2;\n\treturn mat3(\n\t\t1.0 - ( yy + zz ),  xy - wz,            xz + wy,\n\t\txy + wz,            1.0 - ( xx + zz ),  yz - wx,\n\t\txz - wy,            yz + wx,            1.0 - ( xx + yy )\n\t);\n}\nmat3 invInertiaWorld(vec4 q, vec3 invInertia){\n\tmat3 R = quat2mat(q);\n\tmat3 I = mat3(\n\t\tinvInertia.x, 0, 0,\n\t\t0, invInertia.y, 0,\n\t\t0, 0, invInertia.z\n\t);\n\treturn transpose2(R) * I * R;\n}\nvec4 quat_slerp(vec4 v0, vec4 v1, float t){\n\tfloat d = dot(v0, v1);\n\tif (abs(d) > 0.9995) {\n\t\treturn normalize(mix(v0,v1,t));\n\t}\n\tif (d < 0.0) {\n\t\tv1 = -v1;\n\t\td = -d;\n\t}\n\td = clamp(d, -1.0, 1.0);\n\tfloat theta0 = acos(d);\n\tfloat theta = theta0*t;\n\tvec4 v2 = normalize(v1 - v0*d);\n\treturn v0*cos(theta) + v2*sin(theta);\n}\n";

	var demoRenderParticlesVert = "uniform sampler2D particleLocalPosTex;\nuniform sampler2D posTex;\nuniform sampler2D posTexPrev;\nuniform sampler2D quatTex;\nuniform sampler2D quatTexPrev;\nuniform float interpolationValue;\nattribute float particleIndex;\n#define PHONG\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <uv2_vertex>\n\t#include <color_vertex>\n\tvec2 particleUV = indexToUV(particleIndex,resolution);\n#ifdef USE_COLOR\n\tvColor = vec3((floor(particleUV*3.0)+1.0)/3.0,0);\n#endif\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n\t#include <skinbase_vertex>\n\t#include <skinnormal_vertex>\n\tvec4 particlePosAndBodyId = texture2D(particleLocalPosTex,particleUV);\n\tvec2 bodyUV = indexToUV(particlePosAndBodyId.w,bodyTextureResolution);\n\tbodyUV += vec2(0.5) / bodyTextureResolution;\n\tvec4 bodyQuat = texture2D(quatTex,bodyUV).xyzw;\n\tvec3 bodyPos = texture2D(posTex,bodyUV).xyz;\n\tvec4 bodyQuatPrev = texture2D(quatTexPrev,bodyUV).xyzw;\n\tvec3 bodyPosPrev = texture2D(posTexPrev,bodyUV).xyz;\n\tbodyPos = mix(bodyPosPrev,bodyPos,interpolationValue);\n\tbodyQuat = quat_slerp(bodyQuatPrev,bodyQuat,interpolationValue);\n\tobjectNormal.xyz = vec3_applyQuat(objectNormal.xyz, bodyQuat);\n\tvec3 particlePos = particlePosAndBodyId.xyz;\n\tvec3 worldParticlePos = vec3_applyQuat(particlePos, bodyQuat) + bodyPos;\n#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n\tvNormal = normalize( transformedNormal );\n#endif\n\t#include <begin_vertex>\n\ttransformed.xyz = vec3_applyQuat(transformed.xyz, bodyQuat);\n\ttransformed.xyz += worldParticlePos;\n\t#include <displacementmap_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\tvViewPosition = - mvPosition.xyz;\n\t#include <worldpos_vertex>\n\t#include <envmap_vertex>\n\t#include <shadowmap_vertex>\n\t#include <fog_vertex>\n}";

	var demoRenderDepthVert = "uniform sampler2D particleLocalPosTex;\nuniform sampler2D posTex;\nuniform sampler2D posTexPrev;\nuniform sampler2D quatTex;\nuniform sampler2D quatTexPrev;\nuniform float interpolationValue;\nattribute float particleIndex;\n#include <common>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <skinbase_vertex>\n\t#include <begin_vertex>\n\tvec2 particleUV = indexToUV(particleIndex,resolution);\n\tvec4 particlePosAndBodyId = texture2D(particleLocalPosTex,particleUV);\n\tvec2 bodyUV = indexToUV(particlePosAndBodyId.w,bodyTextureResolution);\n\tbodyUV += vec2(0.5) / bodyTextureResolution;\n\tvec4 bodyQuat = texture2D(quatTex,bodyUV).xyzw;\n\tvec3 bodyPos = texture2D(posTex,bodyUV).xyz;\n\tvec4 bodyQuatPrev = texture2D(quatTexPrev,bodyUV).xyzw;\n\tvec3 bodyPosPrev = texture2D(posTexPrev,bodyUV).xyz;\n\tbodyPos = mix(bodyPosPrev,bodyPos,interpolationValue);\n\tbodyQuat = quat_slerp(bodyQuatPrev,bodyQuat,interpolationValue);\n\tvec3 particlePos = particlePosAndBodyId.xyz;\n\tvec3 worldParticlePos = vec3_applyQuat(particlePos, bodyQuat) + bodyPos;\n\ttransformed.xyz = vec3_applyQuat(transformed.xyz, bodyQuat);\n\ttransformed.xyz += worldParticlePos;\n\t#include <displacementmap_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n}";

	var shaders = {
	    shared,
	    renderParticlesVertex: demoRenderParticlesVert,
	    renderDepth: demoRenderDepthVert
	};

	function Demo(parameters){

	    var world, scene, ambientLight, light, camera, controls, renderer, customDepthMaterial, gizmo, gui, stats, groundMesh, interactionSphereMesh, debugMesh, debugGridMesh, controller, boxSize, numParticles;

	    init();
	    animate();

	    function init(){
	        boxSize = new THREE__namespace.Vector3(0.25, 1, 0.25);

	        renderer = new THREE__namespace.WebGLRenderer();
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

	        scene = new THREE__namespace.Scene();

	        light = new THREE__namespace.DirectionalLight();
	        light.castShadow = true;
	        light.shadow.mapSize.width = light.shadow.mapSize.height = 1024;
	        var d = 10;
	        light.shadow.camera.left = -10;
	        light.shadow.camera.right = d;
	        light.shadow.camera.top = d;
	        light.shadow.camera.bottom = -10;
	        light.shadow.camera.far = 100;
	        light.position.set(1,2,1);
	        scene.add(light);

	        ambientLight = new THREE__namespace.AmbientLight( 0x222222 );
	        scene.add( ambientLight );
	        renderer.setClearColor(ambientLight.color, 1.0);

	        camera = new THREE__namespace.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.01, 100 );
	        if(parameters.cameraPosition)
	            camera.position.copy(parameters.cameraPosition);
	        else
	            camera.position.set(0,0.6,1.4);

	        // Add controls
	        controls = new THREE__namespace.OrbitControls( camera, renderer.domElement );
	        controls.enableZoom = true;
	        controls.target.set(0.0, 0.1, 0.0);
	        controls.maxPolarAngle = Math.PI * 0.5;

	        world = parameters.create(renderer);

	        var groundMaterial = new THREE__namespace.MeshPhongMaterial( { color: 0xffffff, specular: 0x000000 } );
	        groundMesh = new THREE__namespace.Mesh( new THREE__namespace.PlaneBufferGeometry( 2000, 2000 ), groundMaterial );
	        groundMesh.rotation.x = - Math.PI / 2;
	        groundMesh.receiveShadow = true;
	        scene.add( groundMesh );

	        // Create an instanced mesh for debug spheres
	        var sphereGeometry = new THREE__namespace.SphereBufferGeometry(world.radius, 8, 8);
	        var instances = world.maxParticles;
	        var debugGeometry = new THREE__namespace.InstancedBufferGeometry();
	        debugGeometry.maxInstancedCount = instances;
	        for(var attributeName in sphereGeometry.attributes){
	            debugGeometry.addAttribute( attributeName, sphereGeometry.attributes[attributeName].clone() );
	        }
	        debugGeometry.setIndex( sphereGeometry.index.clone() );
	        var particleIndices = new THREE__namespace.InstancedBufferAttribute( new Float32Array( instances * 1 ), 1, 1 );
	        for ( var i = 0, ul = particleIndices.count; i < ul; i++ ) {
	            particleIndices.setX( i, i );
	        }
	        debugGeometry.addAttribute( 'particleIndex', particleIndices );
	        debugGeometry.boundingSphere = null;

	        // Particle spheres material / debug material - extend the phong shader in three.js
	        var phongShader = THREE__namespace.ShaderLib.phong;
	        var uniforms = THREE__namespace.UniformsUtils.clone(phongShader.uniforms);
	        uniforms.particleLocalPosTex = { value: null };
	        uniforms.posTex = { value: null };
	        uniforms.posTexPrev = { value: null };
	        uniforms.quatTex = { value: null };
	        uniforms.quatTexPrev = { value: null };
	        uniforms.interpolationValue = { value: 0 };
	        var debugMaterial = new THREE__namespace.ShaderMaterial({
	            uniforms: uniforms,
	            vertexShader: shaders.shared + shaders.renderParticlesVertex,
	            fragmentShader: phongShader.fragmentShader,
	            lights: true,
	            defines: {
	                //USE_MAP: true,
	                bodyTextureResolution: 'vec2(' + world.bodyTextureSize.toFixed(1) + ',' + world.bodyTextureSize.toFixed(1) + ')',
	                resolution: 'vec2(' + world.particleTextureSize.toFixed(1) + ',' + world.particleTextureSize.toFixed(1) + ')'
	            }
	        });
	        debugMesh = new THREE__namespace.Mesh( debugGeometry, debugMaterial );
	        debugMesh.frustumCulled = false;
	        var checkerTexture = new THREE__namespace.DataTexture(new Uint8Array([255,0,0,255, 255,255,255,255]), 2, 1, THREE__namespace.RGBAFormat, THREE__namespace.UnsignedByteType, THREE__namespace.UVMapping);
	        checkerTexture.needsUpdate = true;
	        debugMaterial.uniforms.map.value = checkerTexture;
	        scene.add(debugMesh);

	        initDebugGrid();

	        var meshUniforms = THREE__namespace.UniformsUtils.clone(phongShader.uniforms);
	        meshUniforms.particleLocalPosTex = { value: null };
	        meshUniforms.posTex = { value: null };
	        meshUniforms.posTexPrev = { value: null };
	        meshUniforms.quatTex = { value: null };
	        meshUniforms.quatTexPrev = { value: null };
	        meshUniforms.interpolationValue = { value: 0 };

	        // Create a depth material for rendering instances to shadow map
	        customDepthMaterial = new THREE__namespace.ShaderMaterial({
	            uniforms: THREE__namespace.UniformsUtils.merge([
	                THREE__namespace.ShaderLib.depth.uniforms,
	                meshUniforms
	            ]),
	            vertexShader: shaders.shared + shaders.renderDepth,
	            fragmentShader: THREE__namespace.ShaderLib.depth.fragmentShader,
	            defines: {
	                DEPTH_PACKING: 3201,
	                bodyTextureResolution: 'vec2(' + world.bodyTextureSize.toFixed(1) + ',' + world.bodyTextureSize.toFixed(1) + ')',
	                resolution: 'vec2(' + world.particleTextureSize.toFixed(1) + ',' + world.particleTextureSize.toFixed(1) + ')'
	            }
	        });
	        debugMesh.customDepthMaterial = customDepthMaterial;
	        debugMesh.castShadow = true;
	        debugMesh.receiveShadow = true;

	        // interaction
	        interactionSphereMesh = new THREE__namespace.Mesh(new THREE__namespace.SphereBufferGeometry(1,16,16), new THREE__namespace.MeshPhongMaterial({ color: 0xffffff }));
	        world.getSpherePosition(0, interactionSphereMesh.position);
	        scene.add(interactionSphereMesh);
	        gizmo = new THREE__namespace.TransformControls( camera, renderer.domElement );
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
	            world.step( deltaTime );
	        }
	        prevTime = time;
	    }

	    function initDebugGrid(){
	        var w = world.broadphase.resolution.x * world.radius * 2;
	        var h = world.broadphase.resolution.y * world.radius * 2;
	        var d = world.broadphase.resolution.z * world.radius * 2;
	        var boxGeom = new THREE__namespace.BoxGeometry( w, h, d );
	        var wireframeMaterial = new THREE__namespace.MeshBasicMaterial({ wireframe: true });
	        debugGridMesh = new THREE__namespace.Object3D();
	        var mesh = new THREE__namespace.Mesh(boxGeom,wireframeMaterial);
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

	        customDepthMaterial.uniforms.particleLocalPosTex.value =    debugMesh.material.uniforms.particleLocalPosTex.value =     world.particleLocalPositionTexture;
	        customDepthMaterial.uniforms.posTex.value =                 debugMesh.material.uniforms.posTex.value =                  world.bodyPositionTexture;
	        customDepthMaterial.uniforms.posTexPrev.value =             debugMesh.material.uniforms.posTexPrev.value =              world.bodyPositionPrevTexture;
	        customDepthMaterial.uniforms.quatTex.value =                debugMesh.material.uniforms.quatTex.value =                 world.bodyQuaternionTexture;
	        customDepthMaterial.uniforms.quatTexPrev.value =            debugMesh.material.uniforms.quatTexPrev.value =             world.bodyQuaternionPrevTexture;
	        customDepthMaterial.uniforms.interpolationValue.value =            debugMesh.material.uniforms.interpolationValue.value =             world.interpolationValue;

	        renderer.render( scene, camera );

	        debugMesh.material.uniforms.posTex.value = null;
	        debugMesh.material.uniforms.quatTex.value = null;
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

	            // Shadow rendering
	            renderer.shadowMap.autoUpdate = controller.renderShadows;
	            if(!controller.renderShadows){
	                renderer.clearTarget(light.shadow.map);
	            }

	            // Interaction
	            gizmo.detach(gizmo.object);
	            scene.remove(debugGridMesh);
	            switch(controller.interaction){
	            case 'sphere':
	                gizmo.attach(interactionSphereMesh);
	                break;
	            case 'broadphase':
	                scene.add(debugGridMesh);
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
	        gui.add( controller, "gravity", -10, 10, 0.1 ).onChange( guiChanged );
	        gui.add( controller, "moreObjects" );
	        gui.add( controller, "lessObjects" );
	        gui.add( controller, "renderParticles" ).onChange( guiChanged );
	        gui.add( controller, "renderShadows" ).onChange( guiChanged );
	        gui.add( controller, 'interaction', [ 'none', 'sphere', 'broadphase' ] ).onChange( guiChanged );
	        gui.add( controller, 'sphereRadius', boxSize.x/10, boxSize.x/2 ).onChange( guiChanged );
	        guiChanged();

	        var raycaster = new THREE__namespace.Raycaster();
	        var mouse = new THREE__namespace.Vector2();
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
	}

	return Demo;

}));
