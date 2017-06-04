(function(exports){
'use strict';

var shaders = {

    vertexShader: [
        "void main() {",
        "    gl_Position = vec4( position, 1.0 );",
        "}"
    ].join('\n'),

    testFrag:[
        "uniform sampler2D texture;",
        "uniform vec2 res;",
        "void main() {",
        "    vec2 uv = gl_FragCoord.xy / res;",
        "    gl_FragColor = texture2D( texture, uv );",
        "}"
    ].join('\n'),

    setBodyDataVert: [
        "uniform vec2 res;",
        "attribute float bodyIndex;",
        "attribute vec4 data;",
        "varying vec4 vData;",
        "void main() {",
        "    vec2 uv = indexToUV(bodyIndex, res);",
        "    uv += 0.5 / res;",
        "    gl_PointSize = 1.0;",
        "    vData = data;",
        "    gl_Position = vec4(2.0*uv-1.0, 0, 1);",
        "}"
    ].join('\n'),

    setBodyDataFrag: [
        "varying vec4 vData;",
        "void main() {",
        "    gl_FragColor = vData;",
        "}"
    ].join('\n'),

    mapParticleToCellVert:[
        "uniform sampler2D posTex;",
        "uniform vec3 cellSize;",
        "uniform vec3 gridPos;",
        "attribute float particleIndex;",
        "varying float vParticleIndex;",
        "void main() {",
        "    vParticleIndex = particleIndex;",
        "    vec2 particleUV = indexToUV(particleIndex, resolution);",
        "    vec3 particlePos = texture2D( posTex, particleUV ).xyz;",
        "    // Get particle cell position",
        "    vec3 cellPos = worldPosToGridPos(particlePos, gridPos, cellSize);",
        "    vec2 gridUV = gridPosToGridUV(cellPos, 0, gridResolution);",
        "    gridUV += vec2(1) / gridTextureResolution;// center to cell",
        "    gl_PointSize = 2.0; // Cover 4 pixels in the grid texture",
        "    gl_Position = vec4(2.0*(gridUV-0.5), 0, 1);",
        "}"
    ].join('\n'),

    mapParticleToCellFrag:[
        "varying float vParticleIndex;",
        "void main() {",
        "    gl_FragColor = vec4( vParticleIndex+1.0, 0, 0, 1 ); // indices are stored incremented by 1",
        "}"
    ].join('\n'),

    updateForceFrag:[
        "uniform vec4 params1;",
        "#define stiffness params1.x",
        "#define damping params1.y",
        "#define radius params1.z",
        "uniform vec4 params2;",
        "#define friction params2.y",

        "uniform vec4 params3;",
        "#define interactionSpherePos params3.xyz",
        "#define interactionSphereRadius params3.w",

        "uniform vec3 cellSize;",
        "uniform vec3 gridPos;",

        "uniform sampler2D posTex;",
        "uniform sampler2D velTex;",
        "uniform sampler2D bodyAngularVelTex;",
        "uniform sampler2D gridTex;",

        "vec3 particleForce(float STIFFNESS, float DAMPING, float DAMPING_T, float distance, vec3 xi, vec3 xj, vec3 vi, vec3 vj){",
        "    vec3 rij = xj - xi;",
        "    vec3 rij_unit = normalize(rij);",
        "    vec3 vij = vj - vi;",
        "    vec3 vij_t = vij - dot(vij, rij_unit) * rij_unit;",
        "    vec3 springForce = - STIFFNESS * (distance - length(rij)) * rij_unit; // TODO: Should be max 2*radius?",
        "    vec3 dampingForce = DAMPING * dot(vij,rij_unit) * rij_unit;",
        "    vec3 tangentForce = DAMPING_T * vij_t;",
        "    return springForce + dampingForce + tangentForce;",
        "}",

        "void main() {",
        "    vec2 uv = gl_FragCoord.xy / resolution;",
        "    int particleIndex = uvToIndex(uv, resolution);",

        "    // Get id and position of current",
        "    vec4 positionAndBodyId = texture2D(posTex, uv);",
        "    vec3 position = positionAndBodyId.xyz;",
        "    float bodyId = positionAndBodyId.w;",
        "    vec3 velocity = texture2D(velTex, uv).xyz;",
        "    vec3 particleGridPos = worldPosToGridPos(position, gridPos, cellSize);",
        "    vec3 bodyAngularVelocity = texture2D(bodyAngularVelTex, indexToUV(bodyId,bodyTextureResolution)).xyz;",

        "    vec3 force = vec3(0);",
        "    ivec3 iGridRes = ivec3(gridResolution);",

        "    // Neighbor collisions",
        "    for(int i=-1; i<2; i++){",
        "        for(int j=-1; j<2; j++){",
        "            for(int k=-1; k<2; k++){",
        "                vec3 neighborCellGridPos = particleGridPos + vec3(i,j,k);",
        "                ivec3 iNeighborCellGridPos = ivec3(particleGridPos) + ivec3(i,j,k);",
        "                for(int l=0; l<4; l++){",
        "                    vec2 neighborCellTexUV = gridPosToGridUV(neighborCellGridPos, l, gridResolution);",
        "                    neighborCellTexUV += vec2(0.5) / (2.0 * gridTextureResolution); // center to cell pixel",
        "                    int neighborIndex = int(floor(texture2D(gridTex, neighborCellTexUV).x-1.0 + 0.5)); // indices are stored incremented by 1",
        "                    vec2 neighborUV = indexToUV(float(neighborIndex), resolution);",
        "                    vec4 neighborPositionAndBodyId = texture2D(posTex, neighborUV);",
        "                    vec3 neighborPosition = neighborPositionAndBodyId.xyz;",
        "                    float neighborBodyId = neighborPositionAndBodyId.w;",
        "                    vec3 neighborAngularVelocity = texture2D(bodyAngularVelTex, indexToUV(neighborBodyId,bodyTextureResolution)).xyz;",
        "                    vec3 neighborVelocity = texture2D(velTex, neighborUV).xyz;",
        "                    if(neighborIndex >=0 && neighborIndex != particleIndex && iNeighborCellGridPos.x>=0 && iNeighborCellGridPos.y>=0 && iNeighborCellGridPos.z>=0 && iNeighborCellGridPos.x<iGridRes.x && iNeighborCellGridPos.y<iGridRes.y && iNeighborCellGridPos.z<iGridRes.z){ // Not self!",
        "                        // Apply contact force from neighbor",
        "                        vec3 r = position - neighborPosition;",
        "                        float len = length(r);",
        "                        if(len > 0.0 && len < radius * 2.0){",
        "                            force += particleForce(stiffness, damping, friction, 2.0 * radius, position, neighborPosition, velocity, neighborVelocity);",
        "                        }",
        "                    }",
        "                }",
        "            }",
        "        }",
        "    }",

        "    // Apply force from ground / bounds",
        "    vec3 boxMin = vec3(-boxSize.x, 0.0, -boxSize.z);",
        "    vec3 boxMax = vec3(boxSize.x, boxSize.y*0.5, boxSize.z);",
        "    vec3 dirs[3];",
        "    dirs[0] = vec3(1,0,0);",
        "    dirs[1] = vec3(0,1,0);",
        "    dirs[2] = vec3(0,0,1);",
        "    for(int i=0; i<3; i++){",
        "        vec3 dir = dirs[i];",
        "        vec3 tangentVel = (cross(radius * dir, bodyAngularVelocity) + velocity - dot(velocity,dir) * dir);",
        "        float x = dot(dir,position) - radius;",
        "        if(x < boxMin[i]){",
        "            force += -( stiffness * (x - boxMin[i]) * dir + damping * dot(velocity,dir) * dir);",
        "            force -= friction * tangentVel;",
        "        }",
        "        x = dot(dir,position) + radius;",
        "        if(x > boxMax[i]){",
        "            dir = -dir;",
        "            force -= -( stiffness * (x - boxMax[i]) * dir - damping * dot(velocity,dir) * dir);",
        "            force -= friction * tangentVel;",
        "        }",
        "    }",
        "    // Sphere interaction",
        "    vec3 r = position - interactionSpherePos;",
        "    float len = length(r);",
        "    if(len > 0.0 && len < interactionSphereRadius+radius){",
        "        force += particleForce(stiffness, damping, friction, radius + interactionSphereRadius, position, interactionSpherePos, velocity, vec3(0));",
        "    }",
        "    gl_FragColor = vec4(force, 1.0);",
        "}"
    ].join('\n'),

    updateTorqueFrag:[
        "uniform vec4 params1;",
        "#define stiffness params1.x",
        "#define damping params1.y",
        "#define radius params1.z",
        "uniform vec4 params2;",
        "#define friction params2.y",

        "uniform vec3 cellSize;",
        "uniform vec3 gridPos;",

        "uniform sampler2D posTex;",
        "uniform sampler2D velTex;",
        "uniform sampler2D bodyAngularVelTex;",
        "uniform sampler2D gridTex;",

        "void main() {",
        "    vec2 uv = gl_FragCoord.xy / resolution;",
        "    int particleIndex = uvToIndex(uv, resolution);",

        "    // Get id and position of current",
        "    vec4 positionAndBodyId = texture2D(posTex, uv);",
        "    vec3 position = positionAndBodyId.xyz;",
        "    float bodyId = positionAndBodyId.w;",
        "    vec3 velocity = texture2D(velTex, uv).xyz;",
        "    vec3 angularVelocity = texture2D(bodyAngularVelTex, indexToUV(bodyId, bodyTextureResolution)).xyz;",
        "    vec3 particleGridPos = worldPosToGridPos(position, gridPos, cellSize);",
        "    ivec3 iGridRes = ivec3(gridResolution);",
        "    vec3 torque = vec3(0);",
        "    // Neighbor friction",
        "    for(int i=-1; i<2; i++){",
        "        for(int j=-1; j<2; j++){",
        "            for(int k=-1; k<2; k++){",
        "                vec3 neighborCellGridPos = particleGridPos + vec3(i,j,k);",
        "                ivec3 iNeighborCellGridPos = ivec3(particleGridPos) + ivec3(i,j,k);",
        "                for(int l=0; l<4; l++){",
        "                    vec2 neighborCellTexUV = gridPosToGridUV(neighborCellGridPos, l, gridResolution);",
        "                    neighborCellTexUV += vec2(0.5) / (2.0 * gridTextureResolution); // center to cell pixel",
        "                    int neighborIndex = int(floor(texture2D(gridTex, neighborCellTexUV).x-1.0 + 0.5)); // indices are stored incremented by 1",
        "                    vec2 neighborUV = indexToUV(float(neighborIndex), resolution);",
        "                    vec3 neighborPosition = texture2D(posTex, neighborUV).xyz;",
        "                    vec3 neighborVelocity = texture2D(velTex, neighborUV).xyz;",
        "                    vec3 neighborAngularVelocity = texture2D(bodyAngularVelTex, neighborUV).xyz;",
        "                    if(neighborIndex >=0 && neighborIndex != particleIndex && iNeighborCellGridPos.x>=0 && iNeighborCellGridPos.y>=0 && iNeighborCellGridPos.z>=0 && iNeighborCellGridPos.x<iGridRes.x && iNeighborCellGridPos.y<iGridRes.y && iNeighborCellGridPos.z<iGridRes.z){ // Not self!",
        "                        // Apply contact torque from neighbor",
        "                        vec3 r = position - neighborPosition;",
        "                        float len = length(r);",
        "                        if(len > 0.0 && len < radius * 2.0){",
        "                            vec3 dir = normalize(r);",
        "                            vec3 relVel = velocity - neighborVelocity;",
        "                            vec3 relAngularVel = angularVelocity - neighborAngularVelocity;",
        "                            vec3 relTangentVel = (relVel - dot(relVel, dir) * dir) + cross(radius*dir, relAngularVel);",
        "                            torque += friction * cross(radius*dir, relTangentVel);",
        "                        }",
        "                    }",
        "                }",
        "            }",
        "        }",
        "    }",
        "    // Friction against walls",
        "    vec3 boxMin = vec3(-boxSize.x, 0.0, -boxSize.z);",
        "    vec3 boxMax = vec3(boxSize.x, boxSize.y*0.5, boxSize.z);",
        "    vec3 dirs[3];",
        "    dirs[0] = vec3(1,0,0);",
        "    dirs[1] = vec3(0,1,0);",
        "    dirs[2] = vec3(0,0,1);",
        "    for(int i=0; i<3; i++){",
        "        vec3 dir = dirs[i];",
        "        vec3 relVel = velocity;",
        "        vec3 relAngularVel = angularVelocity;",
        "        if(dot(dir,position) - radius < boxMin[i]){",
        "            vec3 relTangentVel = (relVel - dot(relVel, dir) * dir) + cross(radius * dir, relAngularVel);",
        "            torque += friction * cross(radius * dir, relTangentVel);",
        "        }",
        "        if(dot(dir,position) + radius > boxMax[i]){",
        "            dir = -dir;",
        "            vec3 relTangentVel = relVel - dot(relVel, dir) * dir + cross(radius * dir, relAngularVel);",
        "            torque += friction * cross(radius * dir, relTangentVel);",
        "        }",
        "    }",
        "    gl_FragColor = vec4(torque, 0.0);",
        "}"
    ].join('\n'),

    updateBodyVelocityFrag:[
        "// Should be possible to use for both angular and linear velocity",
        "uniform sampler2D bodyQuatTex;",
        "uniform sampler2D bodyVelTex;",
        "uniform sampler2D bodyForceTex;",
        "uniform sampler2D bodyMassTex;",
        "uniform float linearAngular;",
        "uniform vec3 gravity;",
        "uniform vec3 maxVelocity;",
        "uniform vec4 params2;",
        "#define deltaTime params2.x",
        "#define drag params2.z",

        "void main() {",
        "    vec2 uv = gl_FragCoord.xy / bodyTextureResolution;",
        "    vec4 velocity = texture2D(bodyVelTex, uv);",
        "    vec4 force = texture2D(bodyForceTex, uv);",
        "    vec4 quat = texture2D(bodyQuatTex, uv);",
        "    vec4 massProps = texture2D(bodyMassTex, uv);",
        "    vec3 newVelocity = velocity.xyz;",
        "    if( linearAngular < 0.5 ){",
        "        float invMass = massProps.w;",
        "        newVelocity += (force.xyz + gravity) * deltaTime * invMass;",
        "    } else {",
        "        vec3 invInertia = massProps.xyz;",
        "        newVelocity += force.xyz * deltaTime * invInertiaWorld(quat, invInertia);",
        "    }",
        "    newVelocity = clamp(newVelocity, -maxVelocity, maxVelocity);",

        "    // Apply damping",
        "    newVelocity *= pow(1.0 - drag, deltaTime);",

        "    gl_FragColor = vec4(newVelocity, 1.0);",
        "}",
    ].join('\n'),

    updateBodyPositionFrag:[
        "uniform sampler2D bodyPosTex;",
        "uniform sampler2D bodyVelTex;",
        "uniform vec4 params2;",
        "#define deltaTime params2.x",
        "void main() {",
        "vec2 uv = gl_FragCoord.xy / bodyTextureResolution;",
        "vec4 posTexData = texture2D(bodyPosTex, uv);",
        "vec3 position = posTexData.xyz;",
        "vec3 velocity = texture2D(bodyVelTex, uv).xyz;",
        "gl_FragColor = vec4(position + velocity * deltaTime, 1.0);",
        "}",
    ].join('\n'),

    updateBodyQuaternionFrag:[
        "uniform sampler2D bodyQuatTex;",
        "uniform sampler2D bodyAngularVelTex;",
        "uniform vec4 params2;",
        "#define deltaTime params2.x",

        "void main() {",
        "vec2 uv = gl_FragCoord.xy / bodyTextureResolution;",
        "vec4 quat = texture2D(bodyQuatTex, uv);",
        "vec3 angularVel = texture2D(bodyAngularVelTex, uv).xyz;",
        "gl_FragColor = quat_integrate(quat, angularVel, deltaTime);",
        "}",
    ].join('\n'),

    addParticleForceToBodyVert:[
        "uniform sampler2D relativeParticlePosTex;",
        "uniform sampler2D particleForceTex;",
        "attribute float particleIndex;",
        "attribute float bodyIndex; // Should this be in a texture?",
        "varying vec3 vBodyForce;",
        "void main() {",
        "    vec2 particleUV = indexToUV( particleIndex, resolution );",
        "    vec3 particleForce = texture2D( particleForceTex, particleUV ).xyz;",
        "    vBodyForce = particleForce;",
        "    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );",
        "    bodyUV += vec2(0.5) / bodyTextureResolution;// center to pixel",
        "    gl_PointSize = 1.0;",
        "    gl_Position = vec4(2.0 * (bodyUV - 0.5), -particleIndex / (resolution.x*resolution.y), 1); // have to do this to make additive work?",
        "}"
    ].join('\n'),

    addParticleTorqueToBodyVert:[
        "uniform sampler2D relativeParticlePosTex;",
        "uniform sampler2D particleForceTex;",
        "uniform sampler2D particleTorqueTex;",
        "attribute float particleIndex;",
        "attribute float bodyIndex;",
        "varying vec3 vBodyForce;",
        "void main() {",
        "    vec2 particleUV = indexToUV( particleIndex, resolution );",
        "    vec3 particleForce = texture2D( particleForceTex, particleUV ).xyz;",
        "    vec3 particleTorque = texture2D( particleTorqueTex, particleUV ).xyz;",
        "    vec3 relativeParticlePos = texture2D( relativeParticlePosTex, particleUV ).xyz;",
        "    vBodyForce = cross(relativeParticlePos, particleForce) + particleTorque;",
        "    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );",
        "    bodyUV += vec2(0.5) / bodyTextureResolution;// center to pixel",
        "    gl_PointSize = 1.0;",
        "    gl_Position = vec4(2.0 * (bodyUV - 0.5), -particleIndex / (resolution.x*resolution.y), 1);",
        "}"
    ].join('\n'),

    addParticleForceToBodyFrag:[
        "varying vec3 vBodyForce;",
        "void main() {",
        "   gl_FragColor = vec4(vBodyForce, 1.0);",
        "}"
    ].join('\n'),

    localParticlePositionToRelativeFrag:[
        "uniform sampler2D localParticlePosTex;",
        "uniform sampler2D bodyQuatTex;",
        "void main() {",
        "    vec2 uv = gl_FragCoord.xy / resolution;",
        "    float particleIndex = float(uvToIndex(uv, resolution));",
        "    vec4 particlePosAndBodyId = texture2D( localParticlePosTex, uv );",
        "    vec3 particlePos = particlePosAndBodyId.xyz;",

        "    float bodyIndex = particlePosAndBodyId.w;",
        "    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );",
        "    bodyUV += vec2(0.5) / bodyTextureResolution;// center to pixel",
        "    vec4 bodyQuat = texture2D( bodyQuatTex, bodyUV );",

        "    vec3 relativeParticlePos = vec3_applyQuat(particlePos, bodyQuat);",
        "    gl_FragColor = vec4(relativeParticlePos, bodyIndex);",
        "}",
    ].join('\n'),

    localParticlePositionToWorldFrag:[
        "uniform sampler2D localParticlePosTex;",
        "uniform sampler2D bodyPosTex;",
        "uniform sampler2D bodyQuatTex;",
        "void main() {",
        "    vec2 uv = gl_FragCoord.xy / resolution;",
        "    float particleIndex = float(uvToIndex(uv, resolution));",
        "    vec4 particlePosAndBodyId = texture2D( localParticlePosTex, uv );",
        "    vec3 particlePos = particlePosAndBodyId.xyz;",

        "    float bodyIndex = particlePosAndBodyId.w;",
        "    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );",
        "    bodyUV += vec2(0.5) / bodyTextureResolution; // center to pixel",
        "    vec3 bodyPos = texture2D( bodyPosTex, bodyUV ).xyz;",
        "    vec4 bodyQuat = texture2D( bodyQuatTex, bodyUV );",

        "    vec3 worldParticlePos = vec3_applyQuat(particlePos, bodyQuat) + bodyPos;",
        "    gl_FragColor = vec4(worldParticlePos, bodyIndex);",
        "}",
    ].join('\n'),

    bodyVelocityToParticleVelocityFrag:[
       "uniform sampler2D relativeParticlePosTex;",
       "uniform sampler2D bodyVelTex;",
       "uniform sampler2D bodyAngularVelTex;",
       "void main() {",
       "    vec2 particleUV = gl_FragCoord.xy / resolution;",
       "    vec4 particlePosAndBodyId = texture2D( relativeParticlePosTex, particleUV );",
       "    vec3 relativeParticlePosition = particlePosAndBodyId.xyz;",
       "    float bodyIndex = particlePosAndBodyId.w;",
       "    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );",
       "    bodyUV += vec2(0.5) / bodyTextureResolution;// center to pixel",

       "    vec3 bodyVelocity = texture2D( bodyVelTex, bodyUV ).xyz;",
       "    vec3 bodyAngularVelocity = texture2D( bodyAngularVelTex, bodyUV ).xyz;",
       "    vec3 particleVelocity = bodyVelocity - cross(relativeParticlePosition, bodyAngularVelocity);",

       "    gl_FragColor = vec4(particleVelocity, 1);",
       "}",
    ].join('\n'),

    shared: [
        "int uvToIndex(vec2 uv, vec2 size) {",
            "ivec2 coord = ivec2(floor(uv*size+0.5));",
            "return coord.x + int(size.x) * coord.y;",
        "}",
        "vec2 indexToUV(float index, vec2 res){",
            "vec2 uv = vec2(mod(index/res.x,1.0), floor( index/res.y ) / res.x);",
            "return uv;",
        "}",
        "// Get grid position as a vec3: (xIndex, yIndex, zIndex)",
        "vec3 worldPosToGridPos(vec3 particlePos, vec3 gridPos, vec3 cellSize){",
            "return floor((particlePos - gridPos)/cellSize);",
        "}",
        "// Convert grid position to UV coord in the grid texture",
        "vec2 gridPosToGridUV(vec3 gridPos, int subIndex, vec3 gridRes){",
            "gridPos = clamp(gridPos, vec3(0), gridRes-vec3(1)); // Keep within limits",

        "    vec2 gridUV = 2.0 * gridPos.xz / gridTextureResolution;",

        "    // move to correct z square",
            "vec2 zPos = vec2( mod(gridPos.y, gridZTiling.x), floor(gridPos.y / gridZTiling.y) );",
            "zPos /= gridZTiling;",
            "gridUV += zPos;",

        "    // Choose sub pixel",
            "float fSubIndex = float(subIndex);",
            "gridUV += vec2( mod(fSubIndex,2.0), floor(fSubIndex/2.0) ) / gridTextureResolution;",

        "    return gridUV;",
        "}",
        "// Integrate a quaternion using an angular velocity and deltatime",
        "vec4 quat_integrate(vec4 q, vec3 w, float dt){",
            "float half_dt = dt * 0.5;",

        "    q.x += half_dt * (w.x * q.w + w.y * q.z - w.z * q.y); // TODO: vectorize",
            "q.y += half_dt * (w.y * q.w + w.z * q.x - w.x * q.z);",
            "q.z += half_dt * (w.z * q.w + w.x * q.y - w.y * q.x);",
            "q.w += half_dt * (- w.x * q.x - w.y * q.y - w.z * q.z);",

        "    return normalize(q);",
        "}",

        "// Rotate a vector by a quaternion",
        "vec3 vec3_applyQuat(vec3 v, vec4 q){",
            "float ix =  q.w * v.x + q.y * v.z - q.z * v.y; // TODO: vectorize",
            "float iy =  q.w * v.y + q.z * v.x - q.x * v.z;",
            "float iz =  q.w * v.z + q.x * v.y - q.y * v.x;",
            "float iw = -q.x * v.x - q.y * v.y - q.z * v.z;",

        "    return vec3(",
                "ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,",
                "iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,",
                "iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x",
            ");",
        "}",

        "mat3 transpose2( const in mat3 v ) {",
            "mat3 tmp;",
            "tmp[0] = vec3(v[0].x, v[1].x, v[2].x);",
            "tmp[1] = vec3(v[0].y, v[1].y, v[2].y);",
            "tmp[2] = vec3(v[0].z, v[1].z, v[2].z);",
            "return tmp;",
        "}",

        "mat3 quat2mat(vec4 q){",
            "float x = q.x;",
            "float y = q.y;",
            "float z = q.z;",
            "float w = q.w;",

        "    float x2 = x + x;",
            "float y2 = y + y;",
            "float z2 = z + z;",

        "    float xx = x * x2;",
            "float xy = x * y2;",
            "float xz = x * z2;",
            "float yy = y * y2;",
            "float yz = y * z2;",
            "float zz = z * z2;",
            "float wx = w * x2;",
            "float wy = w * y2;",
            "float wz = w * z2;",

        "    return mat3(",
                "1.0 - ( yy + zz ),  xy - wz,            xz + wy,",
                "xy + wz,            1.0 - ( xx + zz ),  yz - wx,",
                "xz - wy,            yz + wx,            1.0 - ( xx + yy )",
            ");",
        "}",

        "mat3 invInertiaWorld(vec4 q, vec3 invInertia){",
            "mat3 R = quat2mat(q);",
            "mat3 I = mat3(",
                "invInertia.x, 0, 0,",
                "0, invInertia.y, 0,",
                "0, 0, invInertia.z",
            ");",
            "return transpose2(R) * I * R;",
        "}"
    ].join('\n')
};

function getShader(id){
  return shaders.shared + shaders[id];
}

function Broadphase(parameters){
    this.position = new THREE.Vector3(0,0,0);
    this.resolution = new THREE.Vector3(64,64,64);
    this.gridZTiling = new THREE.Vector2();
    this.update();
}
Object.assign(Broadphase.prototype, {
    update: function(){
        var gridPotZ = 1;
        while(gridPotZ * gridPotZ < this.resolution.y) gridPotZ *= 2;
        this.gridZTiling.set(gridPotZ,gridPotZ);
    }
});

function World(parameters){
    parameters = parameters || {};
    var params1 = this.params1 = new THREE.Vector4(
        parameters.stiffness !== undefined ? parameters.stiffness : 1700,
        parameters.damping !== undefined ? parameters.damping : 6,
        parameters.radius !== undefined ? parameters.radius : 0.5,
        0 // unused
    );
    var params2 = this.params2 = new THREE.Vector4(
        parameters.fixedTimeStep !== undefined ? parameters.fixedTimeStep : 1/120,
        parameters.friction !== undefined ? parameters.friction : 2,
        parameters.drag !== undefined ? parameters.drag : 0.1,
        0 // unused
    );
    var params3 = this.params3 = new THREE.Vector4();
    this.time = 0;
    this.fixedTime = 0;
    this.broadphase = new Broadphase();
    this.gravity = new THREE.Vector3(0,0,0);
    if(parameters.gravity) this.gravity.copy(parameters.gravity);
    this.boxSize = new THREE.Vector3(1,1,1);
    if(parameters.boxSize) this.boxSize.copy(parameters.boxSize);
    if(parameters.gridPosition) this.broadphase.position.copy(parameters.gridPosition);
    if(parameters.gridResolution) this.broadphase.resolution.copy(parameters.gridResolution);
    this.broadphase.update();
    this.materials = {};
    this.textures = {};
    this.dataTextures = {};
    this.scenes = {};
    this.renderer = parameters.renderer;
    this.bodyCount = 0;
    this.particleCount = 0;
    this.massDirty = true;
    Object.defineProperties( this, {
        // Size of a cell side, and diameter of a particle
        radius: {
            get: function(){ return params1.z; },
            set: function(s){ params1.z = s; }
        },
        fixedTimeStep: {
            get: function(){ return params2.x; },
            set: function(fixedTimeStep){ params2.x = fixedTimeStep; }
        },
        stiffness: {
            get: function(){ return params1.x; },
            set: function(stiffness){ params1.x = stiffness; },
        },
        damping: {
            get: function(){ return params1.y; },
            set: function(damping){ params1.y = damping; },
        },
        friction: {
            get: function(){ return params2.y; },
            set: function(friction){ params2.y = friction; },
        },
        drag: {
            get: function(){ return params2.z; },
            set: function(drag){ params2.z = drag; },
        },
        maxParticles: {
            get: function(){
                return this.textures.particlePosLocal.width * this.textures.particlePosLocal.height;
            }
        },
        maxBodies: {
            get: function(){
                return this.textures.bodyPosRead.width * this.textures.bodyPosRead.height;
            }
        },
        bodyPositionTexture: {      get: function(){ return this.textures.bodyPosRead.texture; } },
        bodyMassTexture: {          get: function(){ return this.textures.bodyMass.texture; } },
        bodyQuaternionTexture: {    get: function(){ return this.textures.bodyQuatRead.texture; } },
        bodyForceTexture: {         get: function(){ return this.textures.bodyForce.texture; } },
        bodyTextureSize: {          get: function(){ return this.textures.bodyPosRead.width; } },
        particlePositionTexture: {  get: function(){ return this.textures.particlePosWorld.texture; } },
        particleForceTexture: {     get: function(){ return this.textures.particleForce.texture; } },
        particleTextureSize: {      get: function(){ return this.textures.particlePosWorld.width; } },
        gridTexture: {              get: function(){ return this.textures.grid.texture; } }
    });

    this.initTextures(
        parameters.maxBodies || 8,
        parameters.maxParticles || 8
    );

    // Fullscreen render pass helpers
    Object.assign( this.materials, {
        // For rendering a full screen quad
        textured: new THREE.ShaderMaterial({
            uniforms: {
                texture: { value: null },
                res: { value: new THREE.Vector2() },
            },
            vertexShader: getShader( 'vertexShader' ),
            fragmentShader: getShader( 'testFrag' ),
            defines: this.getDefines()
        })
    });
    this.scenes.fullscreen = new THREE.Scene();
    this.fullscreenCamera = new THREE.Camera();
    this.fullscreenCamera.position.z = 1;
    var plane = new THREE.PlaneBufferGeometry( 2, 2 );
    var fullscreenQuad = this.fullscreenQuad = new THREE.Mesh( plane, this.materials.textured );
    this.scenes.fullscreen.add( fullscreenQuad );
}

// Compute upper closest power of 2 for a number
function powerOfTwoCeil(x){
    var result = 1;
    while(result * result < x){
        result *= 2;
    }
    return result;
}

function pixelToId(x,y,sx,sy){
    return x * sx + y;
}
function idToX(id,sx,sy){
    return id % sx;
}
function idToY(id,sx,sy){
    return Math.floor(id / sy);
}
function idToDataIndex(id, w, h){
    var px = idToX(id, w, h);
    var py = idToY(id, w, h);
    var p = 4 * (py * w + px);
    return p;
}

Object.assign( World.prototype, {
    getDefines: function(overrides){
        var boxSize = this.boxSize;
        var particleTextureSize = this.textures.particlePosLocal.height;
        var gridResolution = this.broadphase.resolution;
        var gridZTiling = this.broadphase.gridZTiling;
        var gridTexture = this.textures.grid;
        var numBodies = this.textures.bodyPosRead.width;
        var defines = Object.assign({}, overrides||{}, {
            boxSize: 'vec3(' + boxSize.x + ', ' + boxSize.y + ', ' + boxSize.z + ')',
            resolution: 'vec2( ' + particleTextureSize.toFixed( 1 ) + ', ' + particleTextureSize.toFixed( 1 ) + " )",
            gridResolution: 'vec3( ' + gridResolution.x.toFixed( 1 ) + ', ' + gridResolution.y.toFixed( 1 ) + ', ' + gridResolution.z.toFixed( 1 ) + " )",
            gridZTiling: 'vec2(' + gridZTiling.x + ', ' + gridZTiling.y + ')',
            gridTextureResolution: 'vec2(' + gridTexture.width + ', ' + gridTexture.height + ')',
            bodyTextureResolution: 'vec2( ' + numBodies.toFixed( 1 ) + ', ' + numBodies.toFixed( 1 ) + " )",
        });
        return defines;
    },
    step: function(deltaTime){
        this.internalStep();
        this.time += deltaTime;
    },
    internalStep: function(){
        this.saveRendererState();
        this.flushData();
        this.updateWorldParticlePositions();
        this.updateRelativeParticlePositions();
        this.updateParticleVelocity();
        this.updateGrid();
        this.updateParticleForce();
        this.updateParticleTorque();
        this.updateBodyForce();
        this.updateBodyTorque();
        this.updateBodyVelocity();
        this.updateBodyAngularVelocity();
        this.updateBodyPosition();
        this.updateBodyQuaternion();
        this.restoreRendererState();
        this.fixedTime += this.fixedTimeStep;
    },
    addBody: function(x, y, z, qx, qy, qz, qw, mass, inertiaX, inertiaY, inertiaZ){
        // Position
        var tex = this.dataTextures.bodyPositions;
        tex.needsUpdate = true;
        var data = tex.image.data;
        var w = tex.image.width;
        var h = tex.image.height;
        var p = idToDataIndex(this.bodyCount, w, h);
        data[p + 0] = x;
        data[p + 1] = y;
        data[p + 2] = z;
        data[p + 3] = 1;

        // Quaternion
        data = this.dataTextures.bodyQuaternions.image.data;
        this.dataTextures.bodyQuaternions.needsUpdate = true;
        data[p + 0] = qx;
        data[p + 1] = qy;
        data[p + 2] = qz;
        data[p + 3] = qw;

        // Mass
        data = this.dataTextures.bodyMass.image.data;
        this.dataTextures.bodyMass.needsUpdate = true;
        data[p + 0] = 1/inertiaX;
        data[p + 1] = 1/inertiaY;
        data[p + 2] = 1/inertiaZ;
        data[p + 3] = 1/mass;

        return this.bodyCount++;
    },
    addParticle: function(bodyId, x, y, z){
        // Position
        var tex = this.dataTextures.particleLocalPositions;
        tex.needsUpdate = true;
        var data = tex.image.data;
        var w = tex.image.width;
        var h = tex.image.height;
        var p = idToDataIndex(this.particleCount, w, h);
        data[p + 0] = x;
        data[p + 1] = y;
        data[p + 2] = z;
        data[p + 3] = bodyId;
        //TODO: update point cloud mapping particles -> bodies?
        return this.particleCount++;
    },
    getBodyId: function(particleId){
        var tex = this.dataTextures.particleLocalPositions;
        var data = tex.image.data;
        var w = tex.image.width;
        var h = tex.image.height;
        var p = idToDataIndex(particleId, w, h);
        return this.dataTextures.particleLocalPositions.image.data[p+3];
    },
    setBodyMass: function(bodyId, mass, inertiaX, inertiaY, inertiaZ){
        var tex = this.dataTextures.bodyMass;
        var data = tex.image.data;
        var w = tex.image.width;
        var h = tex.image.height;
        var p = idToDataIndex(bodyId, w, h);
        data[p + 0] = inertiaX > 0 ? 1/inertiaX : 0;
        data[p + 1] = inertiaY > 0 ? 1/inertiaY : 0;
        data[p + 2] = inertiaZ > 0 ? 1/inertiaZ : 0;
        data[p + 3] = mass > 0 ? 1/mass : 0;
        tex.needsUpdate = true;
        this.massDirty = true;
    },
    initTextures: function(maxBodies, maxParticles){
        var type = ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType;
        var bodyTextureSize = powerOfTwoCeil(maxBodies);
        var particleTextureSize = powerOfTwoCeil(maxParticles);

        Object.assign(this.textures, {
            // Body textures
            bodyPosRead: createRenderTarget(bodyTextureSize, bodyTextureSize, type),        // (x,y,z,1)
            bodyPosWrite: createRenderTarget(bodyTextureSize, bodyTextureSize, type),
            bodyQuatRead: createRenderTarget(bodyTextureSize, bodyTextureSize, type),       // (x,y,z,w)
            bodyQuatWrite: createRenderTarget(bodyTextureSize, bodyTextureSize, type),
            bodyVelRead: createRenderTarget(bodyTextureSize, bodyTextureSize, type),        // (vx,vy,vz,1)
            bodyVelWrite: createRenderTarget(bodyTextureSize, bodyTextureSize, type),
            bodyAngularVelRead: createRenderTarget(bodyTextureSize, bodyTextureSize, type), // (wx,wy,wz,1)
            bodyAngularVelWrite: createRenderTarget(bodyTextureSize, bodyTextureSize, type),
            bodyForce: createRenderTarget(bodyTextureSize, bodyTextureSize, type),          // (fx,fy,fz,1)
            bodyTorque: createRenderTarget(bodyTextureSize, bodyTextureSize, type),         // (tx,ty,tz,1)
            bodyMass: createRenderTarget(bodyTextureSize, bodyTextureSize, type),           // (invInertia.xyz, invMass)

            // Particle textures
            particlePosLocal: createRenderTarget(particleTextureSize, particleTextureSize, type),   // (x,y,z,bodyId)
            particlePosRelative: createRenderTarget(particleTextureSize, particleTextureSize, type),// (x,y,z,bodyId)
            particlePosWorld: createRenderTarget(particleTextureSize, particleTextureSize, type),   // (x,y,z,bodyId)
            particleVel: createRenderTarget(particleTextureSize, particleTextureSize, type),        // (x,y,z,1)
            particleForce: createRenderTarget(particleTextureSize, particleTextureSize, type),      // (x,y,z,1)
            particleTorque: createRenderTarget(particleTextureSize, particleTextureSize, type),     // (x,y,z,1)

            // Broadphase
            grid: createRenderTarget(2*this.broadphase.resolution.x*this.broadphase.gridZTiling.x, 2*this.broadphase.resolution.z*this.broadphase.gridZTiling.y, type),
        });

        Object.assign(this.dataTextures, {
            bodyPositions: new THREE.DataTexture( new Float32Array(4*bodyTextureSize*bodyTextureSize), bodyTextureSize, bodyTextureSize, THREE.RGBAFormat, type ),
            bodyQuaternions: new THREE.DataTexture( new Float32Array(4*bodyTextureSize*bodyTextureSize), bodyTextureSize, bodyTextureSize, THREE.RGBAFormat, type ),
            particleLocalPositions: new THREE.DataTexture( new Float32Array(4*particleTextureSize*particleTextureSize), particleTextureSize, particleTextureSize, THREE.RGBAFormat, type ),
            bodyMass: new THREE.DataTexture( new Float32Array(4*bodyTextureSize*bodyTextureSize), bodyTextureSize, bodyTextureSize, THREE.RGBAFormat, type ),
        });
    },
    // Render data to rendertargets
    flushData: function(){
        if(this.massDirty){
            this.flushDataToRenderTarget(this.textures.bodyMass, this.dataTextures.bodyMass);
            this.massDirty = false;
        }

        if(this.time > 0) return; // Only want to flush initial data
        this.flushDataToRenderTarget(this.textures.bodyPosWrite, this.dataTextures.bodyPositions); // Need to initialize both read+write in case someone is interpolating..
        this.flushDataToRenderTarget(this.textures.bodyPosRead, this.dataTextures.bodyPositions);
        this.flushDataToRenderTarget(this.textures.bodyQuatWrite, this.dataTextures.bodyQuaternions);
        this.flushDataToRenderTarget(this.textures.bodyQuatRead, this.dataTextures.bodyQuaternions);
        this.flushDataToRenderTarget(this.textures.particlePosLocal, this.dataTextures.particleLocalPositions);
    },
    flushDataToRenderTarget: function(renderTarget, dataTexture){
        var texturedMaterial = this.materials.textured;
        texturedMaterial.uniforms.texture.value = dataTexture;
        texturedMaterial.uniforms.res.value.set(renderTarget.width,renderTarget.height);
        this.fullscreenQuad.material = texturedMaterial;
        this.renderer.render( this.scenes.fullscreen, this.fullscreenCamera, renderTarget, true );
        texturedMaterial.uniforms.texture.value = null;
        this.fullscreenQuad.material = null;
    },
    setRenderTargetSubData: function(ids, getDataCallback, renderTarget, renderTarget2){
        this.saveRendererState();
        var numVertices = 128; // Good number?
        if(!this.scenes.setBodyData){

            this.materials.setBodyData = new THREE.ShaderMaterial({
                uniforms: {
                    res: { value: new THREE.Vector2() }
                },
                vertexShader: getShader( 'setBodyDataVert' ),
                fragmentShader: getShader( 'setBodyDataFrag' ),
                defines: this.getDefines()
            });

            var onePointPerBodyGeometry = this.onePointPerBodyGeometry = new THREE.BufferGeometry();
            var maxBodies = this.maxBodies;
            var bodyIndices = new Float32Array( numVertices );
            var pixelData = new Float32Array( 4 * numVertices );
            onePointPerBodyGeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( numVertices * 3 ), 3 ) );
            onePointPerBodyGeometry.addAttribute( 'data', new THREE.BufferAttribute( pixelData, 4 ) );
            onePointPerBodyGeometry.addAttribute( 'bodyIndex', new THREE.BufferAttribute( bodyIndices, 1 ) );
            this.setBodyDataMesh = new THREE.Points( onePointPerBodyGeometry, this.materials.setBodyData );
            this.scenes.setBodyData = new THREE.Scene();
            this.scenes.setBodyData.add( this.setBodyDataMesh );
        }

        this.materials.setBodyData.uniforms.res.value.set(this.bodyTextureSize, this.bodyTextureSize);
        var data = new THREE.Vector4();
        for(var startIndex = 0; startIndex < ids.length; startIndex += numVertices){
            var count = Math.min(numVertices, ids.length - startIndex);

            this.onePointPerBodyGeometry.attributes.bodyIndex.needsUpdate = true;
            this.onePointPerBodyGeometry.attributes.bodyIndex.updateRange.count = count;

            this.onePointPerBodyGeometry.attributes.data.needsUpdate = true;
            this.onePointPerBodyGeometry.attributes.data.updateRange.count = count;

            for(var i=0; i<count; i++){
                getDataCallback(data, startIndex + i);
                this.onePointPerBodyGeometry.attributes.bodyIndex.array[i] = ids[startIndex + i];
                this.onePointPerBodyGeometry.attributes.data.array[4*i+0] = data.x;
                this.onePointPerBodyGeometry.attributes.data.array[4*i+1] = data.y;
                this.onePointPerBodyGeometry.attributes.data.array[4*i+2] = data.z;
                this.onePointPerBodyGeometry.attributes.data.array[4*i+3] = data.w;
            }
            this.onePointPerBodyGeometry.setDrawRange( 0, count );
            this.renderer.render( this.scenes.setBodyData, this.fullscreenCamera, renderTarget, false );
            if(renderTarget2){
                this.renderer.render( this.scenes.setBodyData, this.fullscreenCamera, renderTarget2, false );
            }
        }
        this.restoreRendererState();
    },
    setBodyPositions: function(bodyIds, positions){
        this.setRenderTargetSubData(bodyIds, function(out, i){
            out.set(
                positions[i].x,
                positions[i].y,
                positions[i].z,
                1
            );
        }, this.textures.bodyPosRead, this.textures.bodyPosWrite);
    },
    setBodyQuaternions: function(bodyIds, quaternions){
        this.setRenderTargetSubData(bodyIds, function(out, i){
            out.set(
                quaternions[i].x,
                quaternions[i].y,
                quaternions[i].z,
                quaternions[i].w
            );
        }, this.textures.bodyQuatRead, this.textures.bodyQuatWrite);
    },
    setBodyVelocities: function(bodyIds, velocities){
        this.setRenderTargetSubData(bodyIds, function(out, i){
            out.set(
                velocities[i].x,
                velocities[i].y,
                velocities[i].z,
                1
            );
        }, this.textures.bodyVelRead, this.textures.bodyVelWrite);
    },
    setBodyAngularVelocities: function(bodyIds, angularVelocities){
        this.setRenderTargetSubData(bodyIds, function(out, i){
            out.set(
                angularVelocities[i].x,
                angularVelocities[i].y,
                angularVelocities[i].z,
                1
            );
        }, this.textures.bodyAngularVelRead, this.textures.bodyAngularVelWrite);
    },
    setBodyMassProperties: function(bodyIds, masses, inertias){
        this.setRenderTargetSubData(bodyIds, function(out, i){
            out.set(
                inertias[i].x > 0 ? 1 / inertias[i].x : 0,
                inertias[i].y > 0 ? 1 / inertias[i].y : 0,
                inertias[i].z > 0 ? 1 / inertias[i].z : 0,
                masses[i] > 0 ? 1 / masses[i] : 0
            );
        }, this.textures.bodyMass);
    },
    updateWorldParticlePositions: function(){
        var mat = this.materials.localParticlePositionToWorld;
        if(!mat){
            mat = this.materials.localParticlePositionToWorld = new THREE.ShaderMaterial({
                uniforms: {
                    localParticlePosTex:  { value: null },
                    bodyPosTex: { value: null },
                    bodyQuatTex: { value: null },
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'localParticlePositionToWorldFrag' ),
                defines: this.getDefines()
            });
        }

        var renderer = this.renderer;
        renderer.state.buffers.depth.setTest( false );
        renderer.state.buffers.stencil.setTest( false );

        // Local particle positions to world
        this.fullscreenQuad.material = mat;
        mat.uniforms.localParticlePosTex.value = this.textures.particlePosLocal.texture;
        mat.uniforms.bodyPosTex.value = this.textures.bodyPosRead.texture;
        mat.uniforms.bodyQuatTex.value = this.textures.bodyQuatRead.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particlePosWorld, false );
        mat.uniforms.localParticlePosTex.value = null;
        mat.uniforms.bodyPosTex.value = null;
        mat.uniforms.bodyQuatTex.value = null;
        this.fullscreenQuad.material = null;
    },

    updateRelativeParticlePositions: function(){
        var mat = this.materials.localParticlePositionToRelative;
        if(!mat){
            mat = this.materials.localParticlePositionToRelative = new THREE.ShaderMaterial({
                uniforms: {
                    localParticlePosTex:  { value: null },
                    bodyPosTex:  { value: null },
                    bodyQuatTex:  { value: null },
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'localParticlePositionToRelativeFrag' ),
                defines: this.getDefines()
            });
        }

        // Local particle positions to relative
        this.fullscreenQuad.material = mat;
        mat.uniforms.localParticlePosTex.value = this.textures.particlePosLocal.texture;
        mat.uniforms.bodyPosTex.value = this.textures.bodyPosRead.texture;
        mat.uniforms.bodyQuatTex.value = this.textures.bodyQuatRead.texture;
        this.renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particlePosRelative, false );
        this.fullscreenQuad.material = null;
        mat.uniforms.localParticlePosTex.value = null;
        mat.uniforms.bodyPosTex.value = null;
        mat.uniforms.bodyQuatTex.value = null;
    },

    updateParticleVelocity: function(){

        // bodyVelocityToParticleVelocity
        var mat = this.materials.updateParticleVelocity;
        if(!mat){
            mat = this.materials.updateParticleVelocity = new THREE.ShaderMaterial({
                uniforms: {
                    relativeParticlePosTex:  { value: null },
                    bodyVelTex:  { value: null },
                    bodyAngularVelTex:  { value: null },
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'bodyVelocityToParticleVelocityFrag' ),
                defines: this.getDefines()
            });
        }

        // Body velocity to particles in world space
        this.fullscreenQuad.material = mat;
        mat.uniforms.relativeParticlePosTex.value = this.textures.particlePosRelative.texture;
        mat.uniforms.bodyVelTex.value = this.textures.bodyVelRead.texture;
        mat.uniforms.bodyAngularVelTex.value = this.textures.bodyAngularVelRead.texture;
        this.renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particleVel, false );
        this.fullscreenQuad.material = null;
        mat.uniforms.relativeParticlePosTex.value = null;
        mat.uniforms.bodyVelTex.value = null;
        mat.uniforms.bodyAngularVelTex.value = null;
    },

    updateGrid: function(){
        var gridTexture = this.textures.grid;
        var mat = this.materials.mapParticle;
        var setGridStencilMaterial = this.materials.setGridStencil;
        if(!mat){
            mat = this.materials.mapParticle = new THREE.ShaderMaterial({
                uniforms: {
                    posTex: { value: null },
                    cellSize: { value: new THREE.Vector3(this.radius*2, this.radius*2, this.radius*2) },
                    gridPos: { value: this.broadphase.position },
                },
                vertexShader: getShader( 'mapParticleToCellVert' ),
                fragmentShader: getShader( 'mapParticleToCellFrag' ),
                defines: this.getDefines()
            });

            this.scenes.mapParticlesToGrid = new THREE.Scene();
            var mapParticleGeometry = new THREE.BufferGeometry();
            var size = this.textures.particlePosLocal.width;
            var positions = new Float32Array( 3 * size * size );
            var particleIndices = new Float32Array( size * size );
            for(var i=0; i<size*size; i++){
                particleIndices[i] = i; // Need to do this because there's no way to get the vertex index in webgl1 shaders...
            }
            mapParticleGeometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
            mapParticleGeometry.addAttribute( 'particleIndex', new THREE.BufferAttribute( particleIndices, 1 ) );
            this.mapParticleToCellMesh = new THREE.Points( mapParticleGeometry, this.materials.mapParticle );
            this.scenes.mapParticlesToGrid.add( this.mapParticleToCellMesh );

            // Scene for rendering the stencil buffer - one GL_POINT for each grid cell that we render 4 times
            var sceneStencil = this.scenes.stencil = new THREE.Scene();
            var onePointPerTexelGeometry = new THREE.Geometry();
            gridTexture = this.textures.grid;
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
            setGridStencilMaterial = this.materials.setGridStencil = new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, color: 0xffffff });
            this.setGridStencilMesh = new THREE.Points( onePointPerTexelGeometry, setGridStencilMaterial );
            sceneStencil.add( this.setGridStencilMesh );
        }

        // Set up the grid texture for stencil routing.
        // See http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf slide 24
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        var gl = renderer.context;
        renderer.clearTarget( gridTexture, true, false, true );
        buffers.depth.setTest( false );
        buffers.depth.setMask( false ); // dont draw depth
        buffers.color.setMask( false ); // dont draw color
        buffers.color.setLocked( true );
        buffers.depth.setLocked( true );
        buffers.stencil.setTest( true );
        buffers.stencil.setOp( gl.REPLACE, gl.REPLACE, gl.REPLACE );
        buffers.stencil.setClear( 0 );
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
                buffers.stencil.setFunc( gl.ALWAYS, stencilValue, 0xffffffff );
                this.setGridStencilMesh.position.set((x+2)/gridSizeX,(y+2)/gridSizeY,0);
                renderer.render( this.scenes.stencil, this.fullscreenCamera, gridTexture, false );
            }
        }
        buffers.color.setLocked( false );
        buffers.color.setMask( true );
        buffers.depth.setLocked( false );
        buffers.depth.setMask( true );

        // Draw particle positions to grid, use stencil routing.
        buffers.stencil.setFunc( gl.EQUAL, 3, 0xffffffff );
        buffers.stencil.setOp( gl.INCR, gl.INCR, gl.INCR ); // Increment stencil value for every rendered fragment
        this.mapParticleToCellMesh.material = mat;
        mat.uniforms.posTex.value = this.textures.particlePosWorld.texture;
        renderer.render( this.scenes.mapParticlesToGrid, this.fullscreenCamera, this.textures.grid, false );
        mat.uniforms.posTex.value = null;
        this.mapParticleToCellMesh.material = null;
        buffers.stencil.setTest( false );
    },

    updateParticleForce: function(){
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        var gl = renderer.context;

        // Update force material
        var forceMaterial = this.materials.force;
        if(!forceMaterial){
            forceMaterial = this.materials.force = new THREE.ShaderMaterial({
                uniforms: {
                    cellSize: { value: new THREE.Vector3(this.radius*2,this.radius*2,this.radius*2) },
                    gridPos: { value: this.broadphase.position },
                    posTex:  { value: null },
                    velTex:  { value: null },
                    bodyAngularVelTex:  { value: null },
                    gridTex:  { value: this.textures.grid.texture },
                    params1: { value: this.params1 },
                    params2: { value: this.params2 },
                    params3: { value: this.params3 },
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'updateForceFrag' ),
                defines: this.getDefines()
            });
        }

        // Update particle forces / collision reaction
        buffers.depth.setTest( false );
        buffers.stencil.setTest( false );
        this.fullscreenQuad.material = this.materials.force;
        forceMaterial.uniforms.posTex.value = this.textures.particlePosWorld.texture;
        forceMaterial.uniforms.velTex.value = this.textures.particleVel.texture;
        forceMaterial.uniforms.bodyAngularVelTex.value = this.textures.bodyAngularVelRead.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particleForce, false );
        forceMaterial.uniforms.posTex.value = null;
        forceMaterial.uniforms.velTex.value = null;
        forceMaterial.uniforms.bodyAngularVelTex.value = null;
        this.fullscreenQuad.material = null;
    },

    // Update particle torques / collision reaction
    updateParticleTorque: function(){
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        var gl = renderer.context;

        // Update torque material
        var updateTorqueMaterial = this.materials.updateTorque;
        if(!updateTorqueMaterial){
            updateTorqueMaterial = this.materials.updateTorque = new THREE.ShaderMaterial({
                uniforms: {
                    cellSize: { value: new THREE.Vector3(this.radius*2, this.radius*2, this.radius*2) },
                    gridPos: { value: this.broadphase.position },
                    posTex:  { value: null },
                    velTex:  { value: null },
                    bodyAngularVelTex:  { value: null },
                    gridTex:  { value: null },
                    params1: { value: this.params1 },
                    params2: { value: this.params2 },
                    params3: { value: this.params3 },
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'updateTorqueFrag' ),
                defines: this.getDefines()
            });
        }

        buffers.depth.setTest( false );
        buffers.stencil.setTest( false );
        this.fullscreenQuad.material = this.materials.updateTorque;
        updateTorqueMaterial.uniforms.gridTex.value = this.textures.grid.texture;
        updateTorqueMaterial.uniforms.posTex.value = this.textures.particlePosWorld.texture;
        updateTorqueMaterial.uniforms.velTex.value = this.textures.particleVel.texture;
        updateTorqueMaterial.uniforms.bodyAngularVelTex.value = this.textures.bodyAngularVelRead.texture; // Angular velocity for indivitual particles and bodies are the same
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particleTorque, false );
        updateTorqueMaterial.uniforms.posTex.value = null;
        updateTorqueMaterial.uniforms.velTex.value = null;
        updateTorqueMaterial.uniforms.bodyAngularVelTex.value = null; // Angular velocity for indivitual particles and bodies are the same
        updateTorqueMaterial.uniforms.gridTex.value = null;
        this.fullscreenQuad.material = null;
    },

    updateBodyForce: function(){
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        var gl = renderer.context;

        // Add force to body material
        var addForceToBodyMaterial = this.materials.addForceToBody;
        if(!addForceToBodyMaterial){
            addForceToBodyMaterial = this.materials.addForceToBody = new THREE.ShaderMaterial({
                uniforms: {
                    relativeParticlePosTex:  { value: null },
                    particleForceTex:  { value: null }
                },
                vertexShader: getShader( 'addParticleForceToBodyVert' ),
                fragmentShader: getShader( 'addParticleForceToBodyFrag' ),
                defines: this.getDefines(),
                blending: THREE.AdditiveBlending,
                transparent: true
            });

            // Scene for mapping the particle force to bodies - one GL_POINT for each particle
            this.scenes.mapParticlesToBodies = new THREE.Scene();
            var mapParticleToBodyGeometry = new THREE.BufferGeometry();
            var numParticles = this.textures.particlePosLocal.width;
            var bodyIndices = new Float32Array( numParticles * numParticles );
            var particleIndices = new Float32Array( numParticles * numParticles );
            for(var i=0; i<numParticles * numParticles; i++){
                var particleId = i;
                particleIndices[i] = particleId;
                bodyIndices[i] = this.getBodyId(particleId);
            }
            mapParticleToBodyGeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array(numParticles*numParticles*3), 3 ) );
            mapParticleToBodyGeometry.addAttribute( 'particleIndex', new THREE.BufferAttribute( particleIndices, 1 ) );
            mapParticleToBodyGeometry.addAttribute( 'bodyIndex', new THREE.BufferAttribute( bodyIndices, 1 ) );
            this.mapParticleToBodyMesh = new THREE.Points( mapParticleToBodyGeometry, addForceToBodyMaterial );
            this.scenes.mapParticlesToBodies.add( this.mapParticleToBodyMesh );
        }

        // Add force to bodies
        buffers.depth.setTest( false );
        buffers.stencil.setTest( false );
        renderer.clearTarget(this.textures.bodyForce, true, true, true ); // clear the color only?
        this.mapParticleToBodyMesh.material = this.materials.addForceToBody;
        addForceToBodyMaterial.uniforms.relativeParticlePosTex.value = this.textures.particlePosRelative.texture;
        addForceToBodyMaterial.uniforms.particleForceTex.value = this.textures.particleForce.texture;
        renderer.render( this.scenes.mapParticlesToBodies, this.fullscreenCamera, this.textures.bodyForce, false );
        addForceToBodyMaterial.uniforms.relativeParticlePosTex.value = null;
        addForceToBodyMaterial.uniforms.particleForceTex.value = null;
        this.mapParticleToBodyMesh.material = null;
    },

    saveRendererState: function(){
        this.oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        this.oldClearColor = this.renderer.getClearColor().getHex();
        this.oldClearAlpha = this.renderer.getClearAlpha();
        this.renderer.setClearColor( 0x000000, 1.0 );
    },

    restoreRendererState: function(){
        this.renderer.autoClear = this.oldAutoClear;
        this.renderer.setRenderTarget( null );
        this.renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
    },

    updateBodyTorque: function(){
        var renderer = this.renderer;

        // Add torque to body material
        var addTorqueToBodyMaterial = this.materials.addTorqueToBody;
        if(!addTorqueToBodyMaterial){
            addTorqueToBodyMaterial = this.materials.addTorqueToBody = new THREE.ShaderMaterial({
                uniforms: {
                    relativeParticlePosTex: { value: null },
                    particleForceTex: { value: null },
                    particleTorqueTex: { value: null }
                },
                vertexShader: getShader( 'addParticleTorqueToBodyVert' ),
                fragmentShader: getShader( 'addParticleForceToBodyFrag' ), // reuse
                defines: this.getDefines(),
                blending: THREE.AdditiveBlending,
                transparent: true
            });
        }

        // Add torque to bodies
        renderer.clearTarget(this.textures.bodyTorque, true, true, true ); // clear the color only?
        this.mapParticleToBodyMesh.material = addTorqueToBodyMaterial;
        addTorqueToBodyMaterial.uniforms.relativeParticlePosTex.value = this.textures.particlePosRelative.texture;
        addTorqueToBodyMaterial.uniforms.particleForceTex.value = this.textures.particleForce.texture;
        addTorqueToBodyMaterial.uniforms.particleTorqueTex.value = this.textures.particleTorque.texture;
        renderer.render( this.scenes.mapParticlesToBodies, this.fullscreenCamera, this.textures.bodyTorque, false );
        addTorqueToBodyMaterial.uniforms.relativeParticlePosTex.value = null;
        addTorqueToBodyMaterial.uniforms.particleForceTex.value = null;
        addTorqueToBodyMaterial.uniforms.particleTorqueTex.value = null;
        this.mapParticleToBodyMesh.material = null;
    },

    getUpdateVelocityMaterial: function(){
        // Update body velocity - should work for both linear and angular
        var updateBodyVelocityMaterial = this.materials.updateBodyVelocity;
        if(!updateBodyVelocityMaterial){
            updateBodyVelocityMaterial = this.materials.updateBodyVelocity = new THREE.ShaderMaterial({
                uniforms: {
                    linearAngular:  { type: 'f', value: 0.0 },
                    bodyQuatTex:  { value: null },
                    bodyForceTex:  { value: null },
                    bodyVelTex:  { value: null },
                    bodyMassTex:  { value: null },
                    params2: { value: this.params2 },
                    gravity:  { value: this.gravity },
                    maxVelocity: { value: new THREE.Vector3(100,100,100) }
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'updateBodyVelocityFrag' ),
                defines: this.getDefines()
            });
        }
        return updateBodyVelocityMaterial;
    },

    updateBodyVelocity: function(){
        var renderer = this.renderer;

        var updateBodyVelocityMaterial = this.getUpdateVelocityMaterial();

        // Update body velocity
        this.fullscreenQuad.material = updateBodyVelocityMaterial;
        updateBodyVelocityMaterial.uniforms.bodyMassTex.value = this.textures.bodyMass.texture;
        updateBodyVelocityMaterial.uniforms.linearAngular.value = 0;
        updateBodyVelocityMaterial.uniforms.bodyVelTex.value = this.textures.bodyVelRead.texture;
        updateBodyVelocityMaterial.uniforms.bodyForceTex.value = this.textures.bodyForce.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.bodyVelWrite, false );
        this.fullscreenQuad.material = null;
        updateBodyVelocityMaterial.uniforms.bodyMassTex.value = null;
        updateBodyVelocityMaterial.uniforms.bodyVelTex.value = null;
        updateBodyVelocityMaterial.uniforms.bodyForceTex.value = null;
        this.swapTextures('bodyVelWrite', 'bodyVelRead');
    },

    updateBodyAngularVelocity: function(){
        var renderer = this.renderer;
        // Update body angular velocity
        var updateBodyVelocityMaterial = this.getUpdateVelocityMaterial();
        this.fullscreenQuad.material = updateBodyVelocityMaterial;
        updateBodyVelocityMaterial.uniforms.bodyQuatTex.value = this.textures.bodyQuatRead.texture;
        updateBodyVelocityMaterial.uniforms.bodyMassTex.value = this.textures.bodyMass.texture;
        updateBodyVelocityMaterial.uniforms.linearAngular.value = 1;
        updateBodyVelocityMaterial.uniforms.bodyVelTex.value = this.textures.bodyAngularVelRead.texture;
        updateBodyVelocityMaterial.uniforms.bodyForceTex.value = this.textures.bodyTorque.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.bodyAngularVelWrite, false );
        this.fullscreenQuad.material = null;
        updateBodyVelocityMaterial.uniforms.bodyQuatTex.value = null;
        updateBodyVelocityMaterial.uniforms.bodyMassTex.value = null;
        updateBodyVelocityMaterial.uniforms.bodyVelTex.value = null;
        updateBodyVelocityMaterial.uniforms.bodyForceTex.value = null;
        this.swapTextures('bodyAngularVelWrite', 'bodyAngularVelRead');
    },

    updateBodyPosition: function(){
        var renderer = this.renderer;

        // Body position update
        var updateBodyPositionMaterial = this.materials.updateBodyPosition;
        if(!updateBodyPositionMaterial){
            updateBodyPositionMaterial = this.materials.updateBodyPosition = new THREE.ShaderMaterial({
                uniforms: {
                    bodyPosTex:  { value: null },
                    bodyVelTex:  { value: null },
                    params2: { value: this.params2 }
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'updateBodyPositionFrag' ),
                defines: this.getDefines()
            });
        }

        // Update body positions
        this.fullscreenQuad.material = updateBodyPositionMaterial;
        updateBodyPositionMaterial.uniforms.bodyPosTex.value = this.textures.bodyPosRead.texture;
        updateBodyPositionMaterial.uniforms.bodyVelTex.value = this.textures.bodyVelRead.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.bodyPosWrite, false );
        updateBodyPositionMaterial.uniforms.bodyPosTex.value = null;
        updateBodyPositionMaterial.uniforms.bodyVelTex.value = null;
        this.fullscreenQuad.material = null;
        this.swapTextures('bodyPosWrite', 'bodyPosRead');
    },

    updateBodyQuaternion: function(){
        var renderer = this.renderer;

        // Update body quaternions
        var updateBodyQuaternionMaterial = this.materials.updateBodyQuaternion;
        if(!updateBodyQuaternionMaterial){
            updateBodyQuaternionMaterial = this.materials.updateBodyQuaternion = new THREE.ShaderMaterial({
                uniforms: {
                    bodyQuatTex: { value: null },
                    bodyAngularVelTex: { value: null },
                    params2: { value: this.params2 }
                },
                vertexShader: getShader( 'vertexShader' ),
                fragmentShader: getShader( 'updateBodyQuaternionFrag' ),
                defines: this.getDefines()
            });
        }

        // Update body quaternions
        this.fullscreenQuad.material = updateBodyQuaternionMaterial;
        updateBodyQuaternionMaterial.uniforms.bodyQuatTex.value = this.textures.bodyQuatRead.texture;
        updateBodyQuaternionMaterial.uniforms.bodyAngularVelTex.value = this.textures.bodyAngularVelRead.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.bodyQuatWrite, false );
        updateBodyQuaternionMaterial.uniforms.bodyQuatTex.value = null;
        updateBodyQuaternionMaterial.uniforms.bodyAngularVelTex.value = null;
        this.fullscreenQuad.material = null;

        this.swapTextures('bodyQuatWrite', 'bodyQuatRead');
    },

    swapTextures: function(a,b){
        var textures = this.textures;
        if(!textures[a]) throw new Error("missing texture " + a);
        if(!textures[b]) throw new Error("missing texture " + b);
        var tmp = textures[a];
        textures[a] = textures[b];
        textures[b] = tmp;
    },

    setSphereRadius: function(sphereIndex, radius){
        if(sphereIndex !== 0) throw new Error("Multiple spheres not supported yet");
        this.params3.w = radius;
    },

    getSphereRadius: function(sphereIndex){
        if(sphereIndex !== 0) throw new Error("Multiple spheres not supported yet");
        return this.params3.w;
    },

    setSpherePosition: function(sphereIndex, x, y, z){
        if(sphereIndex !== 0) throw new Error("Multiple spheres not supported yet");
        this.params3.x = x;
        this.params3.y = y;
        this.params3.z = z;
    }
});

function createRenderTarget(w,h,type,format){
    return new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: format === undefined ? THREE.RGBAFormat : format,
        type: type
    });
}

Object.assign(exports, {
    Broadphase: Broadphase,
    World: World,
});

}).call(null, this);
