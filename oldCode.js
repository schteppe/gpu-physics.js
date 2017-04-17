var setup = function(args, ctx){

	var parser = new vox.Parser();
	parser.parseUint8Array(ctx.worldData.castleModel, function(err, voxelData) {
		if(err) console.error(err);
		//ctx.voxelData = voxelData;
		setup2(args, ctx);
	});

};

function setup2(args, ctx){
	// Unpack classes
	var Camera = goo.Camera;
	var FullscreenUtil = goo.FullscreenUtil;
	var Material = goo.Material;
	var MeshData = goo.MeshData;
	var RenderTarget = goo.RenderTarget;
	var Shader = goo.Shader;
	var ShaderBuilder = goo.ShaderBuilder;
	var ShaderLib = goo.ShaderLib;
	var Texture = goo.Texture;
	var Transform = goo.Transform;
	var FullscreenPass = goo.FullscreenPass;

	ctx.sizeX = Math.pow(2, args.expX);
	ctx.sizeY = Math.pow(2, args.expY);
	ctx.numParticles = ctx.sizeX * ctx.sizeY;

	console.log(ctx.numParticles + ' particles, texture size: ' + ctx.sizeX + 'x'+ ctx.sizeY);

	// Things to clean up
	ctx.targets = [];
	ctx.materials = [];

	ctx.textureSettings = {
		type: 'Float',
		minFilter: 'NearestNeighborNoMipMaps',
		magFilter: 'NearestNeighbor',
		generateMipmaps: false
	};

	// For copying
	ctx.copyPass = new FullscreenPass(ShaderLib.screenCopy);
	ctx.copyPass.material.depthState.enabled = false;

	ctx.data = new Float32Array(4 * ctx.sizeX * ctx.sizeY);
	ctx.setTargetData = function (target){
		// Put data in texture
		ctx.tmpTexture = new Texture(ctx.data, ctx.textureSettings, ctx.sizeX, ctx.sizeY);

		// Render texture to target
		ctx.copyPass.render(ctx.world.gooRunner.renderer, target, ctx.tmpTexture);
	};

	ctx.setInitialState = function(){
		// Position
		if(ctx.voxelData){
			console.log(ctx.voxelData.voxels.length + ' voxels')
			for (var i = 0; i < ctx.sizeX; i++) {
				for (var j = 0; j < ctx.sizeY; j++) {
					var index = j * ctx.sizeX + i;
					var x,y,z;
					if(index < ctx.voxelData.voxels.length){
						x = ctx.voxelData.voxels[index].x * args.radius * 2.02 + Math.random()*0.001;
						y = ctx.voxelData.voxels[index].z * args.radius * 2.02 + Math.random()*0.001;
						z = -ctx.voxelData.voxels[index].y * args.radius * 2.02 + Math.random()*0.001;
					} else {
						x = y = z = 10000;
					}
					// position
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 0] = x;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 1] = y;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 2] = z;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 3] = 1;
				}
			}
		} else {
			for (var i = 0; i < ctx.sizeX; i++) {
				for (var j = 0; j < ctx.sizeY; j++) {
					var invMass = 1;
					var x = -(0.5 - (j * ctx.sizeX + i) / (ctx.sizeX * ctx.sizeY)) * args.containerSize[0];
					var y = (Math.random() - 0.5) * args.containerSize[1];
					var z = (Math.random() - 0.5) * args.containerSize[2];

					// position
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 0] = x;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 1] = y;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 2] = z;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 3] = 1;
				}
			}
		}
		ctx.setTargetData(ctx.prevPosition);
		ctx.setTargetData(ctx.positionA);
		ctx.setTargetData(ctx.positionB);

		// Velocity
		if(ctx.voxelData){
			for (var i = 0; i < ctx.sizeX; i++) {
				for (var j = 0; j < ctx.sizeY; j++) {
					var index = j * ctx.sizeX + i;
					var invMass = index < ctx.voxelData.voxels.length ? 1 : 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 0] = 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 1] = 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 2] = 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 3] = invMass; // invMass
				}
			}
		} else {
			for (var i = 0; i < ctx.sizeX; i++) {
				for (var j = 0; j < ctx.sizeY; j++) {
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 0] = 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 1] = 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 2] = 0;
					ctx.data[j * 4 * ctx.sizeX + i * 4 + 3] = 1; // invMass
				}
			}
		}
		ctx.setTargetData(ctx.velocityA);
		ctx.setTargetData(ctx.velocityB);

		// Force
		for (var i = 0; i < ctx.sizeX; i++) {
			for (var j = 0; j < ctx.sizeY; j++) {
				ctx.data[j * 4 * ctx.sizeX + i * 4 + 0] = 0;
				ctx.data[j * 4 * ctx.sizeX + i * 4 + 1] = 0;
				ctx.data[j * 4 * ctx.sizeX + i * 4 + 2] = 0;
				ctx.data[j * 4 * ctx.sizeX + i * 4 + 3] = 1;
			}
		}
		ctx.setTargetData(ctx.force);
	};

	// Map from position to id. Then we dont have to sort all targets.
	ctx.prevPosition = new RenderTarget(ctx.sizeX, ctx.sizeY, ctx.textureSettings);
	ctx.positionA = new RenderTarget(ctx.sizeX, ctx.sizeY, ctx.textureSettings);
	ctx.positionB = new RenderTarget(ctx.sizeX, ctx.sizeY, ctx.textureSettings);
	ctx.velocityA = new RenderTarget(ctx.sizeX, ctx.sizeY, ctx.textureSettings);
	ctx.velocityB = new RenderTarget(ctx.sizeX, ctx.sizeY, ctx.textureSettings);
	ctx.force = new RenderTarget(ctx.sizeX, ctx.sizeY, ctx.textureSettings);

	ctx.targets.push(
		ctx.prevPosition,
		ctx.positionA,
		ctx.positionB,
		ctx.velocityA,
		ctx.velocityB,
		ctx.force
	);

	ctx.swap = function(a,b){
		var tmp = ctx[a];
		ctx[a] = ctx[b];
		ctx[b] = tmp;
	};

	ctx.renderable = {
		meshData: FullscreenUtil.quad,
		materials: [],
		transform: new Transform(),
		shaderCache: {}
	};

	ctx.renderMaterial = new Material(renderShader());
	ctx.meshEntity = ctx.world.createEntity([0,0,0], ctx.renderMaterial, createMeshData()).addToWorld();
	ctx.meshEntity.meshRendererComponent.materials[0].cullState.enabled = false;

	ctx.setInitialState();

	ctx.time = 0;
	ctx.accumulator = 0;
	ctx.callbackPreRender = function (tpf) {

        ctx.accumulator += tpf;
        var substeps = 0;
        while (ctx.accumulator >= args.deltaTime && substeps < args.maxSubSteps) {
            // Do fixed steps to catch up
            ctx.step(args.deltaTime);
            ctx.time += args.deltaTime;
            ctx.accumulator -= args.deltaTime;
            substeps++;
        }

        var t = (ctx.accumulator % args.deltaTime) / args.deltaTime;
		ctx.renderMaterial.uniforms.interpolationTime = t;
	};
	ctx.world.gooRunner.callbacksPreRender.push(ctx.callbackPreRender);

	ctx.step = function(){

		// Sort the maps according to X position
		for(var i=0; i < args.sortPasses; i++){
			// Need to sort velocity in the exact same way as position
			sort(ctx.positionB, ctx.positionA, ctx.positionA, 0);
			sort(ctx.velocityB, ctx.velocityA, ctx.positionA, 0);
			sort(ctx.positionA, ctx.positionB, ctx.positionB, 1);
			sort(ctx.velocityA, ctx.velocityB, ctx.positionB, 1);
		}

		// Store the old position
		ctx.copyPass.render(ctx.world.gooRunner.renderer, ctx.prevPosition, ctx.positionA);

		// f = f + f0 + f1...
		collide(ctx.force, ctx.positionA, ctx.velocityA);

		// v = v + f / m * h
		updateVelocity(ctx.velocityB, ctx.velocityA, ctx.force);

		// x = x + v * h
		updatePosition(ctx.positionB, ctx.positionA, ctx.velocityB);

		// Swap buffers
		ctx.swap('positionA','positionB');
		ctx.swap('velocityA','velocityB');

		args.positionDebug.meshRendererComponent.materials[0].setTexture('AO_MAP', ctx.positionA);
		args.velocityDebug.meshRendererComponent.materials[0].setTexture('AO_MAP', ctx.velocityA);
		args.forceDebug.meshRendererComponent.materials[0].setTexture('AO_MAP', ctx.force);

		ctx.meshEntity.meshRendererComponent.materials[0].setTexture('PREV_POS_MAP', ctx.prevPosition);
		ctx.meshEntity.meshRendererComponent.materials[0].setTexture('POS_MAP', ctx.positionA);
	};

	ctx.sortMaterial = new Material(sortShader());
	ctx.materials.push(ctx.sortMaterial);
	function sort(target, source, positions, offset){
		ctx.renderable.materials[0] = ctx.sortMaterial;
		ctx.sortMaterial.uniforms.offset = offset;
		ctx.sortMaterial.setTexture('SORT_MAP', source);
		ctx.sortMaterial.setTexture('POS_MAP', positions);
		ctx.world.gooRunner.renderer.render(ctx.renderable, FullscreenUtil.camera, [], target, false);
	}

	ctx.collideMaterial = new Material(collideShader());
	ctx.materials.push(ctx.collideMaterial);
	function collide(outForce, inPositions, inVelocity){
		ctx.renderable.materials[0] = ctx.collideMaterial;
		var uniforms = ctx.collideMaterial.uniforms;
		ctx.collideMaterial.setTexture('POS_MAP', inPositions);
		ctx.collideMaterial.setTexture('VEL_MAP', inVelocity);
		ctx.world.gooRunner.renderer.render(ctx.renderable, FullscreenUtil.camera, [], outForce, false);
	}

	ctx.updateVelocityMaterial = new Material(updateVelocityShader());
	ctx.materials.push(ctx.updateVelocityMaterial);
	function updateVelocity(outVelocity, inVelocity, inForce){
		ctx.renderable.materials[0] = ctx.updateVelocityMaterial;
		ctx.updateVelocityMaterial.setTexture('VEL_MAP', inVelocity);
		ctx.updateVelocityMaterial.setTexture('FORCE_MAP', inForce);
		ctx.world.gooRunner.renderer.render(ctx.renderable, FullscreenUtil.camera, [], outVelocity, false);
	}

	ctx.updatePositionMaterial = new Material(updatePositionShader());
	ctx.materials.push(ctx.updatePositionMaterial);
	function updatePosition(outPosition, inPosition, inVelocity){
		ctx.renderable.materials[0] = ctx.updatePositionMaterial;
		ctx.updatePositionMaterial.setTexture('POS_MAP', inPosition);
		ctx.updatePositionMaterial.setTexture('VEL_MAP', inVelocity);
		ctx.world.gooRunner.renderer.render(ctx.renderable, FullscreenUtil.camera, [], outPosition, false);
	}

	// Shared stuff
	function particleIndexUV(){
		return [
			'vec2 particleIndexToUV(float particleIndex, vec2 invSize, vec2 size) {',
			'    float x = floor(mod(particleIndex, size.x));',
			'    float y = floor(particleIndex / size.x);',
			'    return vec2(x, y) * invSize + 0.5 * invSize;',
			'}',

			'int validParticleIndex(float particleIndex, vec2 invSize, vec2 size) {',
			'    vec2 uv = particleIndexToUV(particleIndex, invSize, size);',
			'    if(uv.x <= 1.0 && uv.y <= 1.0 && uv.x >= 0.0 && uv.y >= 0.0){',
			'        return 1;',
			'    } else {',
			'        return 0;',
			'    }',
			'}',

			'float getCurrentParticleIndex(vec4 fragCoord, vec2 size) {',
			'   vec2 coord = floor(fragCoord.xy);',
			'   return coord.x + size.x * coord.y;',
			'}'
		].join('\n');
	}

	function sortShader(){
		return {
			attributes: {
				vertexPosition: MeshData.POSITION,
				vertexUV0: MeshData.TEXCOORD0
			},
			uniforms: {
				viewProjectionMatrix: Shader.VIEW_PROJECTION_MATRIX,
				worldMatrix: Shader.WORLD_MATRIX,
				diffuseMap: Shader.DIFFUSE_MAP,
				positionMap: 'POS_MAP',
				unsortedMap: 'SORT_MAP',
				tpf: Shader.TPF,
				offset: 0,
				size: [ctx.sizeX, ctx.sizeY],
				invSize: [1 / ctx.sizeX, 1 / ctx.sizeY]
			},
			vshader: [
				'attribute vec3 vertexPosition;',
				'attribute vec2 vertexUV0;',
				'uniform mat4 viewProjectionMatrix;',
				'uniform mat4 worldMatrix;',
				'varying vec2 vUv;',

				'void main() {',
				'   vUv = vertexUV0;',
				'   gl_Position = viewProjectionMatrix * worldMatrix * vec4(vertexPosition, 1.0);',
				'}'
			].join('\n'),
			fshader: [
				'uniform sampler2D unsortedMap;',
				'uniform sampler2D positionMap;',
				'uniform vec2 invSize;',
				'uniform vec2 size;',
				'uniform float offset;',
				'varying vec2 vUv;',

				particleIndexUV(),

				'float modI(float a,float b) {',
				'    float m=a-floor((a+0.5)/b)*b;',
				'    return floor(m+0.5);',
				'}',

				'void main() {',

				'   float currentParticleIndex = getCurrentParticleIndex(gl_FragCoord, size);',

				// Get id and position of current
				'   vec4 value = texture2D(unsortedMap, vUv);',
				'   vec4 position = texture2D(positionMap, vUv);',

				// Get left and right values & positions
				'   vec2 leftUV = particleIndexToUV(currentParticleIndex - 1.0, invSize, size);',
				'   vec4 leftValue = texture2D(unsortedMap, leftUV);',
				'   vec4 leftPosition = texture2D(positionMap, leftUV);',

				'   vec2 rightUV = particleIndexToUV(currentParticleIndex + 1.0, invSize, size);',
				'   vec4 rightValue = texture2D(unsortedMap, rightUV);',
				'   vec4 rightPosition = texture2D(positionMap, rightUV);',

				// Use Bubble sort to sort
				'   if(int(offset) == 0){',
				'       if(int(modI(currentParticleIndex, 2.0)) == 0){',
				'           if(rightPosition.x > position.x){',
				'               value = rightValue;',
				'           }',
				'       } else {',
				'           if(leftPosition.x < position.x){',
				'               value = leftValue;',
				'           }',
				'       }',
				'   } else {',
				'       if(currentParticleIndex == 0.0 || validParticleIndex(currentParticleIndex + 1.0, invSize, size) == 0){',
				'           // Nothing!',
				'       } else if(int(modI(currentParticleIndex, 2.0)) == 1){',
				'           if(rightPosition.x > position.x){',
				'               value = rightValue;',
				'           }',
				'       } else {',
				'           if(leftPosition.x < position.x){',
				'               value = leftValue;',
				'           }',
				'       }',
				'   }',
				'   gl_FragColor = value;',
				'}'
			].join('\n')
		};
	};

	function collideShader(){
		return {
			defines: {
				HALF_MAX_NEIGHBORS: args.halfMaxNeighbors
			},
			attributes: {
				vertexPosition: MeshData.POSITION,
				vertexUV0: MeshData.TEXCOORD0
			},
			uniforms: {
				viewProjectionMatrix: Shader.VIEW_PROJECTION_MATRIX,
				worldMatrix: Shader.WORLD_MATRIX,
				positionMap: 'POS_MAP',
				velocityMap: 'VEL_MAP',
				gravity: args.gravity,
				radius: args.radius,
				damping: args.damping,
				stiffness: args.stiffness,
				containerSize: args.containerSize,
				invSize: [1 / ctx.sizeX, 1 / ctx.sizeY],
				size: [ctx.sizeX, ctx.sizeY]
			},
			vshader: [
				'attribute vec3 vertexPosition;',
				'attribute vec2 vertexUV0;',
				'varying vec2 vUv;',

				'uniform mat4 viewProjectionMatrix;',
				'uniform mat4 worldMatrix;',

				'void main() {',
				'   vUv = vertexUV0;',
				'   gl_Position = viewProjectionMatrix * worldMatrix * vec4( vertexPosition, 1.0 );',
				'}'
			].join('\n'),
			fshader: [
				'uniform sampler2D positionMap;',
				'uniform sampler2D velocityMap;',
				'uniform float radius;',
				'uniform float stiffness;',
				'uniform float damping;',
				'uniform vec2 invSize;',
				'uniform vec2 size;',
				'uniform vec3 gravity;',
				'uniform vec3 containerSize;',

				'varying vec2 vUv;',

				particleIndexUV(),

				'void main() {',
				'    float currentPixel = getCurrentParticleIndex(gl_FragCoord, size);',

				// Get id and position of current
				'    vec4 position = texture2D(positionMap, vUv);',
				'    vec4 velocity = texture2D(velocityMap, vUv);',
				'    vec3 force = gravity;', // the result

				'    for(int i=-HALF_MAX_NEIGHBORS; i<HALF_MAX_NEIGHBORS; i++){', // grab nearby pixels
				'        float index = currentPixel + float(i);',
				'        if(validParticleIndex(index, invSize, size) == 1){',
				'            vec2 uv = particleIndexToUV(index, invSize, size);',
				'            vec4 otherPos = texture2D(positionMap, uv);',
				'            vec3 r = position.xyz - otherPos.xyz;',
				'            float len = length(r);',
				'            if(len > 0.0 && len < radius * 2.0){',
				'                vec3 dir = normalize(r);',
                '                force -= stiffness * (len - 2.0 * radius) * dir + damping * dot(velocity.xyz, dir) * dir;',
				'            }',
				'        }',
				'    }',

				// container collide
				'    vec3 boxMax = containerSize * 0.5;',
				'    vec3 boxMin = -boxMax;',

				'    if(position.x - radius < boxMin.x){',
				'        float x = position.x - radius;',
				'        float x0 = boxMin.x;',
                '        force.x -= stiffness * (x - x0) + damping * velocity.x;',
				'    }',
				'    if(position.y - radius < boxMin.y){',
				'        float x = position.y - radius;',
				'        float x0 = boxMin.y;',
                '        force.y -= stiffness * (x - x0) + damping * velocity.y;',
				'    }',
				'    if(position.z - radius < boxMin.z){',
				'        float x = position.z - radius;',
				'        float x0 = boxMin.z;',
                '        force.z -= stiffness * (x - x0) + damping * velocity.z;',
				'    }',
				'    if(position.x + radius > boxMax.x){',
				'        float x = position.x + radius;',
				'        float x0 = boxMax.x;',
                '        force.x -= stiffness * (x - x0) + damping * velocity.x;',
				'    }',
				'    if(position.y + radius > boxMax.y){',
				'        float x = position.y + radius;',
				'        float x0 = boxMax.y;',
                '        force.y -= stiffness * (x - x0) + damping * velocity.y;',
				'    }',
				'    if(position.z + radius > boxMax.z){',
				'        float x = position.z + radius;',
				'        float x0 = boxMax.z;',
                '        force.z -= stiffness * (x - x0) + damping * velocity.z;',
				'    }',

				'    gl_FragColor = vec4(force, 1.0);',
				'}'
			].join('\n')
		};
	};

	// v = v + f / m * h
	function updateVelocityShader(){
		return {
			attributes: {
				vertexPosition: MeshData.POSITION,
				vertexUV0: MeshData.TEXCOORD0
			},
			uniforms: {
				viewProjectionMatrix: Shader.VIEW_PROJECTION_MATRIX,
				worldMatrix: Shader.WORLD_MATRIX,
				positionMap: 'POS_MAP',
				velocityMap: 'VEL_MAP',
				forceMap: 'FORCE_MAP',
				invSize: [1 / ctx.sizeX, 1 / ctx.sizeY],
				deltaTime: args.deltaTime
			},
			vshader: [
				'attribute vec3 vertexPosition;',
				'attribute vec2 vertexUV0;',
				'varying vec2 vUv;',

				'uniform mat4 viewProjectionMatrix;',
				'uniform mat4 worldMatrix;',

				'void main() {',
				'   vUv = vertexUV0;',
				'   gl_Position = viewProjectionMatrix * worldMatrix * vec4( vertexPosition, 1.0 );',
				'}'
			].join('\n'),
			fshader: [
				'uniform sampler2D positionMap;',
				'uniform sampler2D velocityMap;',
				'uniform sampler2D forceMap;',
				'uniform vec2 invSize;',
				'uniform float deltaTime;',
				'varying vec2 vUv;',
				'void main() {',
				'   vec4 velocity = texture2D(velocityMap, vUv);',
				'   vec4 force = texture2D(forceMap, vUv);',
				'   float invMass = velocity.w;',
				'   gl_FragColor = vec4(velocity.xyz + force.xyz * deltaTime * invMass, invMass);',
				'}'
			].join('\n')
		};
	};

	function updatePositionShader(){
		return {
			attributes: {
				vertexPosition: MeshData.POSITION,
				vertexUV0: MeshData.TEXCOORD0
			},
			uniforms: {
				viewProjectionMatrix: Shader.VIEW_PROJECTION_MATRIX,
				worldMatrix: Shader.WORLD_MATRIX,
				positionMap: 'POS_MAP',
				velocityMap: 'VEL_MAP',
				deltaTime: args.deltaTime
			},
			vshader: [
				'attribute vec3 vertexPosition;',
				'attribute vec2 vertexUV0;',
				'varying vec2 vUv;',

				'uniform mat4 viewProjectionMatrix;',
				'uniform mat4 worldMatrix;',

				'void main() {',
				'   vUv = vertexUV0;',
				'   gl_Position = viewProjectionMatrix * worldMatrix * vec4( vertexPosition, 1.0 );',
				'}'
			].join('\n'),
			fshader: [
				'uniform sampler2D positionMap;',
				'uniform sampler2D velocityMap;',
				'uniform float deltaTime;',
				'varying vec2 vUv;',

				'void main() {',
				'   vec4 velocity = texture2D(velocityMap, vUv);',
				'   vec4 position = texture2D(positionMap, vUv);',
				'   gl_FragColor = vec4(position.xyz + velocity.xyz * deltaTime, 1.0);',
				'}'
			].join('\n')
		};
	};

	function renderShader(){
		return {
			attributes: {
				vertexPosition: MeshData.POSITION,
				vertexNormal: MeshData.NORMAL,
				particleIndex: 'PARTICLE_INDEX'
			},
			uniforms: {
				viewProjectionMatrix: Shader.VIEW_PROJECTION_MATRIX,
				worldMatrix: Shader.WORLD_MATRIX,
				positionMap: 'POS_MAP',
				prevPositionMap: 'PREV_POS_MAP',
				invSize: [1 / ctx.sizeX,1 / ctx.sizeY],
				size: [ctx.sizeX,ctx.sizeY],
				cameraPosition: Shader.CAMERA,
				interpolationTime: 0
			},
			builder: function (shader, shaderInfo) {
				ShaderBuilder.light.builder(shader, shaderInfo);
			},
			processors: [
				ShaderBuilder.light.processor
			],
			vshader: function(){
				return [
					'attribute vec3 vertexPosition;',
					'attribute vec3 vertexNormal;',
					'attribute float particleIndex;',

					'uniform sampler2D positionMap;',
					'uniform sampler2D prevPositionMap;',

					'uniform vec3 cameraPosition;',
					'uniform mat4 viewProjectionMatrix;',
					'uniform mat4 worldMatrix;',

					'uniform vec2 invSize;',
					'uniform vec2 size;',

					'uniform float interpolationTime;',

					particleIndexUV(),

					ShaderBuilder.light.prevertex,
					'varying vec3 normal;',
					'varying vec3 viewPosition;',

					'void main() {',
					'   vec2 uv = particleIndexToUV(particleIndex, invSize, size);',
					'   vec4 pos = texture2D(positionMap, uv);',
					'   vec4 prevPos = texture2D(prevPositionMap, uv);',
					'   vec3 interpolatedPos = mix(prevPos.xyz, pos.xyz, interpolationTime);',
					'   vec4 worldPos = worldMatrix * (vec4(vertexPosition, 1.0) + vec4(interpolatedPos,0.0));',
					'   gl_Position = viewProjectionMatrix * worldPos;',
					ShaderBuilder.light.vertex,
					'normal = (worldMatrix * vec4(vertexNormal, 0.0)).xyz;',
					'viewPosition = cameraPosition - worldPos.xyz;',
					'}'
				].join('\n');
			},
			fshader: function () {
				return [
					'varying vec3 normal;',
					'uniform vec2 invSize;',
					ShaderBuilder.light.prefragment,
					'varying vec3 viewPosition;',
					'void main() {',
					'    vec3 N = normalize(normal);',
					'    vec4 final_color = vec4(1,0,0,1);',
					ShaderBuilder.light.fragment,
					'    gl_FragColor = final_color;',
					'}'
				].join('\n');
			}
		};
	};

	function createMeshData(){
		var attributeMap = MeshData.defaultMap([
			MeshData.POSITION,
			MeshData.NORMAL
		]);
		attributeMap.PARTICLE_INDEX = MeshData.createAttribute(1, 'Float');
		var mesh = new goo.Sphere(args.geometrySamples,args.geometrySamples,args.radius);
		var meshData = new MeshData(
			attributeMap,
			ctx.numParticles * mesh.vertexCount,
			ctx.numParticles * mesh.indexCount
		);
		console.log(meshData.vertexCount + ' vertices')

		var pos = meshData.getAttributeBuffer(MeshData.POSITION);
		var normal = meshData.getAttributeBuffer(MeshData.NORMAL);
		var particleIndices = meshData.getAttributeBuffer('PARTICLE_INDEX');
		var indices = meshData.getIndexBuffer();

		var meshIndices = mesh.getIndexBuffer();
		var meshPos = mesh.getAttributeBuffer(MeshData.POSITION);
		var meshNormal = mesh.getAttributeBuffer(MeshData.NORMAL);

		var meshVertexCount = mesh.vertexCount;

		for (var i = 0; i < ctx.numParticles; i++) {
			for (var j = 0; j < meshPos.length; j++) {
				pos[i * meshPos.length + j] = meshPos[j];
			}
			for (var j = 0; j < meshNormal.length; j++) {
				normal[i * meshNormal.length + j] = meshNormal[j];
			}
			for (var j = 0; j < meshIndices.length; j++) {
				indices[i * meshIndices.length + j] = meshIndices[j] + i * meshVertexCount;
			}
			for (var j = 0; j < mesh.vertexCount; j++) {
				particleIndices[i * mesh.vertexCount + j] = i;
			}
		}
		meshData.setAttributeDataUpdated(MeshData.POSITION);
		meshData.setAttributeDataUpdated(MeshData.NORMAL);
		meshData.setAttributeDataUpdated('PARTICLE_INDEX');

		return meshData;
	}

	// TEST
	/*
	sort(ctx.positionB, ctx.positionA, ctx.positionA, 0);
	sort(ctx.velocityB, ctx.velocityA, ctx.positionA, 0);
	sort(ctx.positionA, ctx.positionB, ctx.positionB, 1);
	sort(ctx.velocityA, ctx.velocityB, ctx.positionB, 1);
	collide(ctx.force, ctx.positionA, ctx.velocityA);
	updateVelocity(ctx.velocityB, ctx.velocityA, ctx.force);
	updatePosition(ctx.positionB, ctx.positionA, ctx.velocityB);

	args.positionDebug.meshRendererComponent.materials[0].setTexture('AO_MAP', ctx.positionB);
	args.velocityDebug.meshRendererComponent.materials[0].setTexture('AO_MAP', ctx.velocityB);
	args.forceDebug.meshRendererComponent.materials[0].setTexture('AO_MAP', ctx.force);
	*/

};

var cleanup = function(args, ctx) {
	var cbs = ctx.world.gooRunner.callbacksPreRender;
	if(cbs){
		var idx = cbs.indexOf(ctx.callbackPreRender);
		if(idx !== -1){
			cbs.splice(idx, 1);
		}
	}

	for (var i = 0; ctx.targets && i < ctx.targets.length; i++) {
		ctx.targets[i].destroy(ctx.world.gooRunner.renderer.context);
	}
	for (var i = 0; ctx.materials && i < ctx.materials.length; i++) {
		ctx.materials[i].shader.destroy();
	}
	if(ctx.meshEntity)
		ctx.meshEntity.removeFromWorld();
};

var update = function(args, ctx) {

};

var parameters = [{
	key: 'sortPasses',
	type: 'int',
	min: 1,
	'default': 5
},{
	key: 'maxSubSteps',
	type: 'int',
	min: 1,
	'default': 5
},{
	key: 'expX',
	type: 'int',
	min: 1,
	'default': 2
},{
	key: 'expY',
	type: 'int',
	min: 1,
	'default': 2
},{
	key: 'halfMaxNeighbors',
	type: 'int',
	min: 2,
	'default': 100
},{
	key: 'radius',
	type: 'float',
	min: 0.000000001,
	'default': 0.1,
	min: 0
},{
	key: 'geometrySamples',
	type: 'int',
	min: 4,
	'default': 8
},{
	key: 'gravity',
	type: 'vec3',
	'default': [0,0,0]
},{
	key: 'deltaTime',
	type: 'float',
	'default': 0.16,
	min: 0
},{
	key: 'damping',
	type: 'float',
	'default': 1,
	min: 0
},{
	key: 'stiffness',
	type: 'float',
	'default': 100,
	min: 0
},{
	key: 'containerSize',
	type: 'vec3',
	'default': [1,1,1]
},{
	key: 'positionDebug',
	type: 'entity'
},{
	key: 'velocityDebug',
	type: 'entity'
},{
	key: 'forceDebug',
	type: 'entity'
}];