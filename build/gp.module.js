'use strict';

var THREE = require('three');

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

var passThroughVert = "void main() {\n    gl_Position = vec4( position, 1.0 );\n}";

var passThroughFrag = "uniform sampler2D texture;\nuniform vec2 res;\nvoid main() {\n\tvec2 uv = gl_FragCoord.xy / res;\n\tgl_FragColor = texture2D( texture, uv );\n}";

var setBodyDataVert = "uniform vec2 res;\nattribute float bodyIndex;\nattribute vec4 data;\nvarying vec4 vData;\nvoid main() {\n\tvec2 uv = indexToUV(bodyIndex, res);\n\tuv += 0.5 / res;\n\tgl_PointSize = 1.0;\n\tvData = data;\n\tgl_Position = vec4(2.0*uv-1.0, 0, 1);\n}";

var setBodyDataFrag = "varying vec4 vData;\nvoid main() {\n\tgl_FragColor = vData;\n}";

var mapParticleToCellVert = "uniform sampler2D posTex;\nuniform vec3 cellSize;\nuniform vec3 gridPos;\nattribute float particleIndex;\nvarying float vParticleIndex;\nvoid main() {\n    vParticleIndex = particleIndex;\n    vec2 particleUV = indexToUV(particleIndex, resolution);\n    vec3 particlePos = texture2D( posTex, particleUV ).xyz;\n    vec3 cellPos = worldPosToGridPos(particlePos, gridPos, cellSize);\n    vec2 gridUV = gridPosToGridUV(cellPos, 0, gridResolution, gridTextureResolution, gridZTiling);\n    gridUV += vec2(1) / gridTextureResolution;    gl_PointSize = 2.0;    gl_Position = vec4(2.0*(gridUV-0.5), 0, 1);\n}";

var mapParticleToCellFrag = "varying float vParticleIndex;\nvoid main() {\n    gl_FragColor = vec4( vParticleIndex+1.0, 0, 0, 1 );}";

var updateForceFrag = "uniform vec4 params1;\n#define stiffness params1.x\n#define damping params1.y\n#define radius params1.z\nuniform vec4 params2;\n#define friction params2.y\nuniform vec4 params3;\n#define interactionSpherePos params3.xyz\n#define interactionSphereRadius params3.w\nuniform vec3 cellSize;\nuniform vec3 gridPos;\nuniform sampler2D posTex;\nuniform sampler2D velTex;\nuniform sampler2D bodyAngularVelTex;\nuniform sampler2D particlePosRelative;\nuniform sampler2D gridTex;\nvec3 particleForce(float STIFFNESS, float DAMPING, float DAMPING_T, float distance, float minDistance, vec3 xi, vec3 xj, vec3 vi, vec3 vj){\n    vec3 rij = xj - xi;\n    vec3 rij_unit = normalize(rij);\n    vec3 vij = vj - vi;\n    vec3 vij_t = vij - dot(vij, rij_unit) * rij_unit;\n    vec3 springForce = - STIFFNESS * (distance - max(length(rij), minDistance)) * rij_unit;\n    vec3 dampingForce = DAMPING * dot(vij,rij_unit) * rij_unit;\n    vec3 tangentForce = DAMPING_T * vij_t;\n    return springForce + dampingForce + tangentForce;\n}\nvoid main() {\n    vec2 uv = gl_FragCoord.xy / resolution;\n    int particleIndex = uvToIndex(uv, resolution);\n    vec4 positionAndBodyId = texture2D(posTex, uv);\n    vec3 position = positionAndBodyId.xyz;\n    float bodyId = positionAndBodyId.w;\n    vec3 velocity = texture2D(velTex, uv).xyz;\n    vec3 particleGridPos = worldPosToGridPos(position, gridPos, cellSize);\n    vec3 bodyAngularVelocity = texture2D(bodyAngularVelTex, indexToUV(bodyId,bodyTextureResolution)).xyz;\n    vec4 relativePositionAndBodyId = texture2D(particlePosRelative, uv);\n    vec3 relativePosition = relativePositionAndBodyId.xyz;\n    vec3 force = vec3(0);\n    ivec3 iGridRes = ivec3(gridResolution);\n    for(int i=-1; i<2; i++){\n        for(int j=-1; j<2; j++){\n            for(int k=-1; k<2; k++){\n                vec3 neighborCellGridPos = particleGridPos + vec3(i,j,k);\n                ivec3 iNeighborCellGridPos = ivec3(particleGridPos) + ivec3(i,j,k);\n                for(int l=0; l<4; l++){\n                    vec2 neighborCellTexUV = gridPosToGridUV(neighborCellGridPos, l, gridResolution, gridTextureResolution, gridZTiling);\n                    neighborCellTexUV += vec2(0.5) / (2.0 * gridTextureResolution);                    int neighborIndex = int(floor(texture2D(gridTex, neighborCellTexUV).x-1.0 + 0.5));                    vec2 neighborUV = indexToUV(float(neighborIndex), resolution);\n                    vec4 neighborPositionAndBodyId = texture2D(posTex, neighborUV);\n                    vec3 neighborPosition = neighborPositionAndBodyId.xyz;\n                    float neighborBodyId = neighborPositionAndBodyId.w;\n                    vec3 neighborAngularVelocity = texture2D(bodyAngularVelTex, indexToUV(neighborBodyId,bodyTextureResolution)).xyz;\n                    vec3 neighborVelocity = texture2D(velTex, neighborUV).xyz;\n                    vec3 neighborRelativePosition = texture2D(particlePosRelative, neighborUV).xyz;\n                    if(neighborIndex >=0 && neighborIndex != particleIndex && neighborBodyId != bodyId && iNeighborCellGridPos.x>=0 && iNeighborCellGridPos.y>=0 && iNeighborCellGridPos.z>=0 && iNeighborCellGridPos.x<iGridRes.x && iNeighborCellGridPos.y<iGridRes.y && iNeighborCellGridPos.z<iGridRes.z){                        vec3 r = position - neighborPosition;\n                        float len = length(r);\n                        if(len > 0.0 && len < radius * 2.0){\n                            vec3 dir = normalize(r);\n                            vec3 v = velocity - cross(relativePosition + radius * dir, bodyAngularVelocity);\n                            vec3 nv = neighborVelocity - cross(neighborRelativePosition + radius * (-dir), neighborAngularVelocity);\n                            force += particleForce(stiffness, damping, friction, 2.0 * radius, radius, position, neighborPosition, v, nv);\n                        }\n                    }\n                }\n            }\n        }\n    }\n    vec3 boxMin = vec3(-boxSize.x, 0.0, -boxSize.z);\n    vec3 boxMax = vec3(boxSize.x, boxSize.y*0.5, boxSize.z);\n    vec3 dirs[3];\n    dirs[0] = vec3(1,0,0);\n    dirs[1] = vec3(0,1,0);\n    dirs[2] = vec3(0,0,1);\n    for(int i=0; i<3; i++){\n        vec3 dir = dirs[i];\n        vec3 v = velocity - cross(relativePosition + radius * dir, bodyAngularVelocity);\n        vec3 tangentVel = v - dot(v,dir) * dir;\n        float x = dot(dir,position) - radius;\n        if(x < boxMin[i]){\n            force += -( stiffness * (x - boxMin[i]) * dir + damping * dot(v,dir) * dir);\n            force -= friction * tangentVel;\n        }\n        x = dot(dir,position) + radius;\n        if(x > boxMax[i]){\n            dir = -dir;\n            force -= -( stiffness * (x - boxMax[i]) * dir - damping * dot(v,dir) * dir);\n            force -= friction * tangentVel;\n        }\n    }\n    vec3 r = position - interactionSpherePos;\n    float len = length(r);\n    if(len > 0.0 && len < interactionSphereRadius+radius){\n        force += particleForce(stiffness, damping, friction, radius + interactionSphereRadius, interactionSphereRadius, position, interactionSpherePos, velocity, vec3(0));\n    }\n    gl_FragColor = vec4(force, 1.0);\n}";

var updateTorqueFrag = "uniform vec4 params1;\n#define stiffness params1.x\n#define damping params1.y\n#define radius params1.z\nuniform vec4 params2;\n#define friction params2.y\nuniform vec3 cellSize;\nuniform vec3 gridPos;\nuniform sampler2D posTex;\nuniform sampler2D particlePosRelative;\nuniform sampler2D velTex;\nuniform sampler2D bodyAngularVelTex;\nuniform sampler2D gridTex;\nvoid main() {\n    vec2 uv = gl_FragCoord.xy / resolution;\n    int particleIndex = uvToIndex(uv, resolution);\n    vec4 positionAndBodyId = texture2D(posTex, uv);\n    vec3 position = positionAndBodyId.xyz;\n    float bodyId = positionAndBodyId.w;\n    vec4 relativePositionAndBodyId = texture2D(particlePosRelative, uv);\n    vec3 relativePosition = relativePositionAndBodyId.xyz;\n    vec3 velocity = texture2D(velTex, uv).xyz;\n    vec3 angularVelocity = texture2D(bodyAngularVelTex, indexToUV(bodyId, bodyTextureResolution)).xyz;\n    vec3 particleGridPos = worldPosToGridPos(position, gridPos, cellSize);\n    ivec3 iGridRes = ivec3(gridResolution);\n    vec3 torque = vec3(0);\n    for(int i=-1; i<2; i++){\n        for(int j=-1; j<2; j++){\n            for(int k=-1; k<2; k++){\n                vec3 neighborCellGridPos = particleGridPos + vec3(i,j,k);\n                ivec3 iNeighborCellGridPos = ivec3(particleGridPos) + ivec3(i,j,k);\n                for(int l=0; l<4; l++){\n                    vec2 neighborCellTexUV = gridPosToGridUV(neighborCellGridPos, l, gridResolution, gridTextureResolution, gridZTiling);\n                    neighborCellTexUV += vec2(0.5) / (2.0 * gridTextureResolution);\n                    int neighborIndex = int(floor(texture2D(gridTex, neighborCellTexUV).x-1.0 + 0.5));\n                    vec2 neighborUV = indexToUV(float(neighborIndex), resolution);\n                    vec4 neighborPositionAndBodyId = texture2D(posTex, neighborUV);\n                    vec3 neighborPosition = neighborPositionAndBodyId.xyz;\n                    float neighborBodyId = neighborPositionAndBodyId.w;\n                    vec3 neighborVelocity = texture2D(velTex, neighborUV).xyz;\n                    vec3 neighborAngularVelocity = texture2D(bodyAngularVelTex, neighborUV).xyz;\n                    vec3 neighborRelativePosition = texture2D(particlePosRelative, neighborUV).xyz;\n                    if(neighborIndex >= 0 && neighborIndex != particleIndex && neighborBodyId != bodyId && iNeighborCellGridPos.x>=0 && iNeighborCellGridPos.y>=0 && iNeighborCellGridPos.z>=0 && iNeighborCellGridPos.x<iGridRes.x && iNeighborCellGridPos.y<iGridRes.y && iNeighborCellGridPos.z<iGridRes.z){\n                        vec3 r = position - neighborPosition;\n                        float len = length(r);\n                        if(len > 0.0 && len < radius * 2.0){\n                            vec3 dir = normalize(r);\n                            vec3 relVel = (velocity - cross(relativePosition + radius * dir, angularVelocity)) - (neighborVelocity - cross(neighborRelativePosition + radius * (-dir), neighborAngularVelocity));\n                            vec3 relTangentVel = relVel - dot(relVel, dir) * dir;\n                            torque += friction * cross(relativePosition + radius * dir, relTangentVel);\n                        }\n                    }\n                }\n            }\n        }\n    }\n    vec3 boxMin = vec3(-boxSize.x, 0.0, -boxSize.z);\n    vec3 boxMax = vec3(boxSize.x, boxSize.y*0.5, boxSize.z);\n    vec3 dirs[3];\n    dirs[0] = vec3(1,0,0);\n    dirs[1] = vec3(0,1,0);\n    dirs[2] = vec3(0,0,1);\n    for(int i=0; i<3; i++){\n        vec3 dir = dirs[i];\n        vec3 v = velocity - cross(relativePosition + radius * dir, angularVelocity);\n        if(dot(dir,position) - radius < boxMin[i]){\n            vec3 relTangentVel = (v - dot(v, dir) * dir);\n            torque += friction * cross(relativePosition + radius * dir, relTangentVel);\n        }\n        if(dot(dir,position) + radius > boxMax[i]){\n            dir = -dir;\n            vec3 relTangentVel = v - dot(v, dir) * dir;\n            torque += friction * cross(relativePosition + radius * dir, relTangentVel);\n        }\n    }\n    gl_FragColor = vec4(torque, 0.0);\n}";

var updateBodyVelocityFrag = "uniform sampler2D bodyQuatTex;\nuniform sampler2D bodyVelTex;\nuniform sampler2D bodyForceTex;\nuniform sampler2D bodyMassTex;\nuniform float linearAngular;\nuniform vec3 gravity;\nuniform vec3 maxVelocity;\nuniform vec4 params2;\n#define deltaTime params2.x\n#define drag params2.z\nvoid main() {\n    vec2 uv = gl_FragCoord.xy / bodyTextureResolution;\n    vec4 velocity = texture2D(bodyVelTex, uv);\n    vec4 force = texture2D(bodyForceTex, uv);\n    vec4 quat = texture2D(bodyQuatTex, uv);\n    vec4 massProps = texture2D(bodyMassTex, uv);\n    vec3 newVelocity = velocity.xyz;\n    if( linearAngular < 0.5 ){\n        float invMass = massProps.w;\n        newVelocity += (force.xyz + gravity) * deltaTime * invMass;\n    } else {\n        vec3 invInertia = massProps.xyz;\n        newVelocity += force.xyz * deltaTime * invInertiaWorld(quat, invInertia);\n    }\n    newVelocity = clamp(newVelocity, -maxVelocity, maxVelocity);\n    newVelocity *= pow(1.0 - drag, deltaTime);\n    gl_FragColor = vec4(newVelocity, 1.0);\n}";

var updateBodyPositionFrag = "uniform sampler2D bodyPosTex;\nuniform sampler2D bodyVelTex;\nuniform vec4 params2;\n#define deltaTime params2.x\nvoid main() {\n\tvec2 uv = gl_FragCoord.xy / bodyTextureResolution;\n\tvec4 posTexData = texture2D(bodyPosTex, uv);\n\tvec3 position = posTexData.xyz;\n\tvec3 velocity = texture2D(bodyVelTex, uv).xyz;\n\tgl_FragColor = vec4(position + velocity * deltaTime, 1.0);\n}";

var updateBodyQuaternionFrag = "uniform sampler2D bodyQuatTex;\nuniform sampler2D bodyAngularVelTex;\nuniform vec4 params2;\n#define deltaTime params2.x\nvoid main() {\n\tvec2 uv = gl_FragCoord.xy / bodyTextureResolution;\n\tvec4 quat = texture2D(bodyQuatTex, uv);\n\tvec3 angularVel = texture2D(bodyAngularVelTex, uv).xyz;\n\tgl_FragColor = quat_integrate(quat, angularVel, deltaTime);\n}";

var addParticleForceToBodyVert = "uniform sampler2D relativeParticlePosTex;\nuniform sampler2D particleForceTex;\nattribute float particleIndex;\nattribute float bodyIndex;varying vec3 vBodyForce;\nvoid main() {\n    vec2 particleUV = indexToUV( particleIndex, resolution );\n    vec3 particleForce = texture2D( particleForceTex, particleUV ).xyz;\n    vBodyForce = particleForce;\n    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );\n    bodyUV += vec2(0.5) / bodyTextureResolution;    gl_PointSize = 1.0;\n    gl_Position = vec4(2.0 * (bodyUV - 0.5), -particleIndex / (resolution.x*resolution.y), 1);\n}";

var addParticleTorqueToBodyVert = "uniform sampler2D relativeParticlePosTex;\nuniform sampler2D particleForceTex;\nuniform sampler2D particleTorqueTex;\nattribute float particleIndex;\nattribute float bodyIndex;\nvarying vec3 vBodyForce;\nvoid main() {\n    vec2 particleUV = indexToUV( particleIndex, resolution );\n    vec3 particleForce = texture2D( particleForceTex, particleUV ).xyz;\n    vec3 particleTorque = texture2D( particleTorqueTex, particleUV ).xyz;\n    vec3 relativeParticlePos = texture2D( relativeParticlePosTex, particleUV ).xyz;\n    vBodyForce = particleTorque + cross(relativeParticlePos, particleForce);\n    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );\n    bodyUV += vec2(0.5) / bodyTextureResolution;    gl_PointSize = 1.0;\n    gl_Position = vec4(2.0 * (bodyUV - 0.5), -particleIndex / (resolution.x*resolution.y), 1);\n}";

var addParticleForceToBodyFrag = "varying vec3 vBodyForce;\nvoid main() {\n\tgl_FragColor = vec4(vBodyForce, 1.0);\n}";

var localParticlePositionToRelativeFrag = "uniform sampler2D localParticlePosTex;\nuniform sampler2D bodyQuatTex;\nvoid main() {\n\tvec2 uv = gl_FragCoord.xy / resolution;\n\tfloat particleIndex = float(uvToIndex(uv, resolution));\n\tvec4 particlePosAndBodyId = texture2D( localParticlePosTex, uv );\n\tvec3 particlePos = particlePosAndBodyId.xyz;\n\tfloat bodyIndex = particlePosAndBodyId.w;\n\tvec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );\n\tbodyUV += vec2(0.5) / bodyTextureResolution;\tvec4 bodyQuat = texture2D( bodyQuatTex, bodyUV );\n\tvec3 relativeParticlePos = vec3_applyQuat(particlePos, bodyQuat);\n\tgl_FragColor = vec4(relativeParticlePos, bodyIndex);\n}";

var localParticlePositionToWorldFrag = "uniform sampler2D localParticlePosTex;\nuniform sampler2D bodyPosTex;\nuniform sampler2D bodyQuatTex;\nvoid main() {\n\tvec2 uv = gl_FragCoord.xy / resolution;\n\tfloat particleIndex = float(uvToIndex(uv, resolution));\n\tvec4 particlePosAndBodyId = texture2D( localParticlePosTex, uv );\n\tvec3 particlePos = particlePosAndBodyId.xyz;\n\tfloat bodyIndex = particlePosAndBodyId.w;\n\tvec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );\n\tbodyUV += vec2(0.5) / bodyTextureResolution;\tvec3 bodyPos = texture2D( bodyPosTex, bodyUV ).xyz;\n\tvec4 bodyQuat = texture2D( bodyQuatTex, bodyUV );\n\tvec3 worldParticlePos = vec3_applyQuat(particlePos, bodyQuat) + bodyPos;\n\tgl_FragColor = vec4(worldParticlePos, bodyIndex);\n}";

var bodyVelocityToParticleVelocityFrag = "uniform sampler2D relativeParticlePosTex;\nuniform sampler2D bodyVelTex;\nuniform sampler2D bodyAngularVelTex;\nvoid main() {\n\tvec2 particleUV = gl_FragCoord.xy / resolution;\n\tvec4 particlePosAndBodyId = texture2D( relativeParticlePosTex, particleUV );\n\tvec3 relativeParticlePosition = particlePosAndBodyId.xyz;\n\tfloat bodyIndex = particlePosAndBodyId.w;\n\tvec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );\n\tbodyUV += vec2(0.5) / bodyTextureResolution;\n\tvec3 bodyVelocity = texture2D( bodyVelTex, bodyUV ).xyz;\n\tvec3 bodyAngularVelocity = texture2D( bodyAngularVelTex, bodyUV ).xyz;\n\tvec3 particleVelocity = bodyVelocity - cross(relativeParticlePosition, bodyAngularVelocity);\n\tgl_FragColor = vec4(particleVelocity, 1);\n}";

var setStencilFrag = "uniform vec2 res;\nuniform float quadrant;\nvoid main() {\n\tvec2 coord = floor(gl_FragCoord.xy);\n\tif(mod(coord.x,2.0) + 2.0 * mod(coord.y,2.0) == quadrant){\n\t\tgl_FragColor = vec4(1,1,1,1);\n\t} else {\n\t\tdiscard;\n\t}\n}";

var shared = "int uvToIndex(vec2 uv, vec2 size) {\n\tivec2 coord = ivec2(floor(uv*size+0.5));\n\treturn coord.x + int(size.x) * coord.y;\n}\nvec2 indexToUV(float index, vec2 res){\n\tvec2 uv = vec2(mod(index/res.x,1.0), floor( index/res.y ) / res.x);\n\treturn uv;\n}\nvec3 worldPosToGridPos(vec3 particlePos, vec3 gridPos, vec3 cellSize){\n\treturn floor((particlePos - gridPos)/cellSize);\n}\nvec2 gridPosToGridUV(vec3 gridPos, int subIndex, vec3 gridRes, vec2 gridTextureRes, vec2 gridZTile){\n\tgridPos = clamp(gridPos, vec3(0), gridRes-vec3(1));\n\tvec2 gridUV = 2.0 * gridPos.xz / gridTextureRes;\n\tvec2 zPos = vec2( mod(gridPos.y, gridZTile.x), floor(gridPos.y / gridZTile.y) );\n\tzPos /= gridZTile;\n\tgridUV += zPos;\n\tfloat fSubIndex = float(subIndex);\n\tgridUV += vec2( mod(fSubIndex,2.0), floor(fSubIndex/2.0) ) / gridTextureRes;\n\treturn gridUV;\n}\nvec4 quat_integrate(vec4 q, vec3 w, float dt){\n\tfloat half_dt = dt * 0.5;\n\tq.x += half_dt * (w.x * q.w + w.y * q.z - w.z * q.y);\tq.y += half_dt * (w.y * q.w + w.z * q.x - w.x * q.z);\n\tq.z += half_dt * (w.z * q.w + w.x * q.y - w.y * q.x);\n\tq.w += half_dt * (- w.x * q.x - w.y * q.y - w.z * q.z);\n\treturn normalize(q);\n}\nvec3 vec3_applyQuat(vec3 v, vec4 q){\n\tfloat ix =  q.w * v.x + q.y * v.z - q.z * v.y;\tfloat iy =  q.w * v.y + q.z * v.x - q.x * v.z;\n\tfloat iz =  q.w * v.z + q.x * v.y - q.y * v.x;\n\tfloat iw = -q.x * v.x - q.y * v.y - q.z * v.z;\n\treturn vec3(\n\t\tix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,\n\t\tiy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,\n\t\tiz * q.w + iw * -q.z + ix * -q.y - iy * -q.x\n\t);\n}\nmat3 transpose2( const in mat3 v ) {\n\tmat3 tmp;\n\ttmp[0] = vec3(v[0].x, v[1].x, v[2].x);\n\ttmp[1] = vec3(v[0].y, v[1].y, v[2].y);\n\ttmp[2] = vec3(v[0].z, v[1].z, v[2].z);\n\treturn tmp;\n}\nmat3 quat2mat(vec4 q){\n\tfloat x = q.x;\n\tfloat y = q.y;\n\tfloat z = q.z;\n\tfloat w = q.w;\n\tfloat x2 = x + x;\n\tfloat y2 = y + y;\n\tfloat z2 = z + z;\n\tfloat xx = x * x2;\n\tfloat xy = x * y2;\n\tfloat xz = x * z2;\n\tfloat yy = y * y2;\n\tfloat yz = y * z2;\n\tfloat zz = z * z2;\n\tfloat wx = w * x2;\n\tfloat wy = w * y2;\n\tfloat wz = w * z2;\n\treturn mat3(\n\t\t1.0 - ( yy + zz ),  xy - wz,            xz + wy,\n\t\txy + wz,            1.0 - ( xx + zz ),  yz - wx,\n\t\txz - wy,            yz + wx,            1.0 - ( xx + yy )\n\t);\n}\nmat3 invInertiaWorld(vec4 q, vec3 invInertia){\n\tmat3 R = quat2mat(q);\n\tmat3 I = mat3(\n\t\tinvInertia.x, 0, 0,\n\t\t0, invInertia.y, 0,\n\t\t0, 0, invInertia.z\n\t);\n\treturn transpose2(R) * I * R;\n}\nvec4 quat_slerp(vec4 v0, vec4 v1, float t){\n\tfloat d = dot(v0, v1);\n\tif (abs(d) > 0.9995) {\n\t\treturn normalize(mix(v0,v1,t));\n\t}\n\tif (d < 0.0) {\n\t\tv1 = -v1;\n\t\td = -d;\n\t}\n\td = clamp(d, -1.0, 1.0);\n\tfloat theta0 = acos(d);\n\tfloat theta = theta0*t;\n\tvec4 v2 = normalize(v1 - v0*d);\n\treturn v0*cos(theta) + v2*sin(theta);\n}\n";

var shaders = {
    passThroughVert,
    passThroughFrag,
    setBodyDataVert,
    setBodyDataFrag,
    mapParticleToCellVert,
    mapParticleToCellFrag,
    updateForceFrag,
    updateTorqueFrag,
    updateBodyVelocityFrag,
    updateBodyPositionFrag,
    updateBodyQuaternionFrag,
    addParticleForceToBodyVert,
    addParticleTorqueToBodyVert,
    addParticleForceToBodyFrag,
    localParticlePositionToRelativeFrag,
    localParticlePositionToWorldFrag,
    bodyVelocityToParticleVelocityFrag,
    shared
};

function getShader(id){
  return shaders.shared + shaders[id];
}

function Broadphase(parameters){
    this.position = new THREE__namespace.Vector3(0,0,0);
    this.resolution = new THREE__namespace.Vector3(64,64,64);
    this.gridZTiling = new THREE__namespace.Vector2();
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
    var params1 = this.params1 = new THREE__namespace.Vector4(
        parameters.stiffness !== undefined ? parameters.stiffness : 1700,
        parameters.damping !== undefined ? parameters.damping : 6,
        parameters.radius !== undefined ? parameters.radius : 0.5,
        0 // unused
    );
    var params2 = this.params2 = new THREE__namespace.Vector4(
        parameters.fixedTimeStep !== undefined ? parameters.fixedTimeStep : 1/120,
        parameters.friction !== undefined ? parameters.friction : 2,
        parameters.drag !== undefined ? parameters.drag : 0.1,
        0 // unused
    );
    this.params3 = new THREE__namespace.Vector4(10,10,10, 1);
    this.time = 0;
    this.fixedTime = 0;
    this.broadphase = new Broadphase();
    this.gravity = new THREE__namespace.Vector3(0,0,0);
    this.maxVelocity = new THREE__namespace.Vector3(100000,100000,100000);
    if(parameters.gravity) this.gravity.copy(parameters.gravity);
    this.boxSize = new THREE__namespace.Vector3(1,1,1);
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

    this.maxSubSteps = parameters.maxSubSteps || 5;
    this.accumulator = 0;
    this.interpolationValue = 0;

    var that = this;
    function updateMaxVelocity(){
        // Set max velocity so that we don't get too much overlap between 2 particles in one time step
        var v = 2 * that.radius / that.fixedTimeStep;
        that.maxVelocity.set(v,v,v);
    }

    Object.defineProperties( this, {
        // Size of a cell side, and diameter of a particle
        radius: {
            get: function(){ return params1.z; },
            set: function(s){
                params1.z = s;
                updateMaxVelocity();
            }
        },
        fixedTimeStep: {
            get: function(){ return params2.x; },
            set: function(fixedTimeStep){
                params2.x = fixedTimeStep;
                updateMaxVelocity();
            }
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
        bodyPositionPrevTexture: {  get: function(){ return this.textures.bodyPosWrite.texture; } },
        bodyQuaternionTexture: {    get: function(){ return this.textures.bodyQuatRead.texture; } },
        bodyQuaternionPrevTexture: {get: function(){ return this.textures.bodyQuatWrite.texture; } },
        bodyMassTexture: {          get: function(){ return this.textures.bodyMass.texture; } },
        bodyForceTexture: {         get: function(){ return this.textures.bodyForce.texture; } },
        bodyTextureSize: {          get: function(){ return this.textures.bodyPosRead.width; } },
        particlePositionTexture: {  get: function(){ return this.textures.particlePosWorld.texture; } },
        particleLocalPositionTexture: {  get: function(){ return this.textures.particlePosLocal.texture; } },
        particleForceTexture: {     get: function(){ return this.textures.particleForce.texture; } },
        particleTextureSize: {      get: function(){ return this.textures.particlePosWorld.width; } },
        gridTexture: {              get: function(){ return this.textures.grid.texture; } }
    });

    updateMaxVelocity();

    this.initTextures(
        parameters.maxBodies || 8,
        parameters.maxParticles || 8
    );

    // Fullscreen render pass helpers
    Object.assign( this.materials, {
        // For rendering a full screen quad
        textured: new THREE__namespace.ShaderMaterial({
            uniforms: {
                texture: { value: null },
                res: { value: new THREE__namespace.Vector2() },
            },
            vertexShader: passThroughVert,
            fragmentShader: passThroughFrag
        })
    });
    this.scenes.fullscreen = new THREE__namespace.Scene();
    this.fullscreenCamera = new THREE__namespace.Camera();
    var plane = new THREE__namespace.PlaneBufferGeometry( 2, 2 );
    var fullscreenQuad = this.fullscreenQuad = new THREE__namespace.Mesh( plane, this.materials.textured );
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
function idToX(id,sx,sy){
    return id % sx;
}
function idToY(id,sx,sy){
    return Math.floor(id / sy);
}
function idToDataIndex(id, w, h){
    var px = idToX(id, w);
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
        var accumulator = this.accumulator;
        var fixedTimeStep = this.fixedTimeStep;

        accumulator += deltaTime;
        var substeps = 0;
        while (accumulator >= fixedTimeStep) {
            // Do fixed steps to catch up
            if(substeps < this.maxSubSteps){
                this.singleStep();
            }
            accumulator -= fixedTimeStep;
            substeps++;
        }

        this.interpolationValue = accumulator / fixedTimeStep;
        this.time += deltaTime;
        this.accumulator = accumulator;
    },
    singleStep: function(){
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

        if(this.bodyCount >= this.maxBodies){
            console.warn("Too many bodies: " + this.bodyCount);
            return;
        }

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
        if(this.particleCount >= this.maxParticles){
            console.warn("Too many particles: " + this.particleCount);
            return;
        }
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
        tex.image.data;
        var w = tex.image.width;
        var h = tex.image.height;
        var p = idToDataIndex(particleId, w, h);
        return this.dataTextures.particleLocalPositions.image.data[p+3];
    },
    getBodyUV: function(bodyId){
        var s = this.bodyTextureSize;
        return new THREE__namespace.Vector2(
            idToX(bodyId, s) / s,
            idToY(bodyId, s, s) / s
        );
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
        var type = ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE__namespace.HalfFloatType : THREE__namespace.FloatType;
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
            bodyPositions: new THREE__namespace.DataTexture( new Float32Array(4*bodyTextureSize*bodyTextureSize), bodyTextureSize, bodyTextureSize, THREE__namespace.RGBAFormat, type ),
            bodyQuaternions: new THREE__namespace.DataTexture( new Float32Array(4*bodyTextureSize*bodyTextureSize), bodyTextureSize, bodyTextureSize, THREE__namespace.RGBAFormat, type ),
            particleLocalPositions: new THREE__namespace.DataTexture( new Float32Array(4*particleTextureSize*particleTextureSize), particleTextureSize, particleTextureSize, THREE__namespace.RGBAFormat, type ),
            bodyMass: new THREE__namespace.DataTexture( new Float32Array(4*bodyTextureSize*bodyTextureSize), bodyTextureSize, bodyTextureSize, THREE__namespace.RGBAFormat, type ),
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

            this.materials.setBodyData = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    res: { value: new THREE__namespace.Vector2() }
                },
                vertexShader: getShader( 'setBodyDataVert' ),
                fragmentShader: getShader( 'setBodyDataFrag' ),
                defines: this.getDefines()
            });

            var onePointPerBodyGeometry = this.onePointPerBodyGeometry = new THREE__namespace.BufferGeometry();
            this.maxBodies;
            var bodyIndices = new Float32Array( numVertices );
            var pixelData = new Float32Array( 4 * numVertices );
            onePointPerBodyGeometry.addAttribute( 'position', new THREE__namespace.BufferAttribute( new Float32Array( numVertices * 3 ), 3 ) );
            onePointPerBodyGeometry.addAttribute( 'data', new THREE__namespace.BufferAttribute( pixelData, 4 ) );
            onePointPerBodyGeometry.addAttribute( 'bodyIndex', new THREE__namespace.BufferAttribute( bodyIndices, 1 ) );
            this.setBodyDataMesh = new THREE__namespace.Points( onePointPerBodyGeometry, this.materials.setBodyData );
            this.scenes.setBodyData = new THREE__namespace.Scene();
            this.scenes.setBodyData.add( this.setBodyDataMesh );
        }

        this.materials.setBodyData.uniforms.res.value.set(this.bodyTextureSize, this.bodyTextureSize);
        var data = new THREE__namespace.Vector4();
        var attributes = this.onePointPerBodyGeometry.attributes;

        for(var startIndex = 0; startIndex < ids.length; startIndex += numVertices){
            var count = Math.min(numVertices, ids.length - startIndex);

            attributes.bodyIndex.needsUpdate = true;
            attributes.bodyIndex.updateRange.count = count;

            attributes.data.needsUpdate = true;
            attributes.data.updateRange.count = count;

            for(var i=0; i<count; i++){
                getDataCallback(data, startIndex + i);
                attributes.bodyIndex.array[i] = ids[startIndex + i];
                attributes.data.array[4*i+0] = data.x;
                attributes.data.array[4*i+1] = data.y;
                attributes.data.array[4*i+2] = data.z;
                attributes.data.array[4*i+3] = data.w;
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
            mat = this.materials.localParticlePositionToWorld = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    localParticlePosTex:  { value: null },
                    bodyPosTex: { value: null },
                    bodyQuatTex: { value: null },
                },
                vertexShader: passThroughVert,
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
            mat = this.materials.localParticlePositionToRelative = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    localParticlePosTex:  { value: null },
                    bodyPosTex:  { value: null },
                    bodyQuatTex:  { value: null },
                },
                vertexShader: passThroughVert,
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
            mat = this.materials.updateParticleVelocity = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    relativeParticlePosTex:  { value: null },
                    bodyVelTex:  { value: null },
                    bodyAngularVelTex:  { value: null },
                },
                vertexShader: passThroughVert,
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

    resetGridStencilOld: function(){

        var gridTexture = this.textures.grid;
        this.materials.mapParticle;
        var setGridStencilMaterial = this.materials.setGridStencil;

        if(this.scenes.stencil === undefined){
            // Scene for rendering the stencil buffer - one GL_POINT for each grid cell that we render 4 times
            var sceneStencil = this.scenes.stencil = new THREE__namespace.Scene();
            var onePointPerTexelGeometry = new THREE__namespace.Geometry();
            gridTexture = this.textures.grid;
            for(var i=0; i<gridTexture.width/2; i++){
                for(var j=0; j<gridTexture.height/2; j++){
                    onePointPerTexelGeometry.vertices.push(
                        new THREE__namespace.Vector3(
                            2*i/(gridTexture.width/2)-1,
                            2*j/(gridTexture.height/2)-1,
                            0
                        )
                    );
                }
            }
            setGridStencilMaterial = this.materials.setGridStencil = new THREE__namespace.PointsMaterial({ size: 1, sizeAttenuation: false, color: 0xffffff });
            this.setGridStencilMesh = new THREE__namespace.Points( onePointPerTexelGeometry, setGridStencilMaterial );
            sceneStencil.add( this.setGridStencilMesh );
        }

        // Set up the grid texture for stencil routing.
        // See http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf slide 24
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        var gl = renderer.context;
        renderer.clearTarget( gridTexture, true, true, true );
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
    },

    resetGridStencil: function(){

        if(this.scenes.stencil2 === undefined){
            this.materials.stencil = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    res: { value: new THREE__namespace.Vector2(this.textures.grid.width,this.textures.grid.height) },
                    quadrant: { value: 0.0 }
                },
                vertexShader: passThroughVert,
                fragmentShader: setStencilFrag,
            });

            this.scenes.stencil2 = new THREE__namespace.Scene();
            var quad = new THREE__namespace.Mesh( new THREE__namespace.PlaneBufferGeometry( 2, 2 ), this.materials.stencil );
            this.scenes.stencil2.add( quad );
        }

        var renderer = this.renderer;
        renderer.setClearColor(0x000000, 1.0);
        renderer.clearTarget( this.textures.grid, true, false, true ); // color, depth, stencil
        var buffers = renderer.state.buffers;
        var gl = renderer.context;
        buffers.depth.setTest( false );
        buffers.depth.setMask( false ); // dont draw depth
        buffers.depth.setLocked( true );
        buffers.color.setMask( false ); // dont draw color
        buffers.color.setLocked( true );
        buffers.stencil.setTest( true );
        buffers.stencil.setOp( gl.REPLACE, gl.REPLACE, gl.REPLACE );
        buffers.stencil.setClear( 0 );
        buffers.stencil.setFunc( gl.ALWAYS, 1, 0xffffffff ); //always set stencil to 1
        for(var i=0;i<2;i++){
            for(var j=0;j<2;j++){
                var stencilValue = i + j * 2;
                if(stencilValue === 0){
                    continue; // No need to set 0 stencil value, it's already cleared
                }
                this.materials.stencil.uniforms.quadrant.value = stencilValue;
                buffers.stencil.setFunc( gl.ALWAYS, stencilValue, 0xffffffff );
                renderer.render( this.scenes.stencil2, this.fullscreenCamera, this.textures.grid, false );
            }
        }
        buffers.depth.setLocked( false );
        buffers.depth.setMask( true );
        buffers.depth.setTest( true );
        buffers.color.setLocked( false );
        buffers.color.setMask( true );
    },

    updateGrid: function(){

        if(!window.a){
            this.resetGridStencil();
        } else {
            this.resetGridStencilOld();
        }

        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        var gl = renderer.context;

        this.textures.grid;
        var mat = this.materials.mapParticle;
        this.materials.setGridStencil;
        if(!mat){
            mat = this.materials.mapParticle = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    posTex: { value: null },
                    cellSize: { value: new THREE__namespace.Vector3(this.radius*2, this.radius*2, this.radius*2) },
                    gridPos: { value: this.broadphase.position },
                },
                vertexShader: getShader( 'mapParticleToCellVert' ),
                fragmentShader: getShader( 'mapParticleToCellFrag' ),
                defines: this.getDefines()
            });

            this.scenes.mapParticlesToGrid = new THREE__namespace.Scene();
            var mapParticleGeometry = new THREE__namespace.BufferGeometry();
            var size = this.textures.particlePosLocal.width;
            var positions = new Float32Array( 3 * size * size );
            var particleIndices = new Float32Array( size * size );
            for(var i=0; i<size*size; i++){
                particleIndices[i] = i; // Need to do this because there's no way to get the vertex index in webgl1 shaders...
            }
            mapParticleGeometry.addAttribute( 'position', new THREE__namespace.BufferAttribute( positions, 3 ) );
            mapParticleGeometry.addAttribute( 'particleIndex', new THREE__namespace.BufferAttribute( particleIndices, 1 ) );
            this.mapParticleToCellMesh = new THREE__namespace.Points( mapParticleGeometry, this.materials.mapParticle );
            this.scenes.mapParticlesToGrid.add( this.mapParticleToCellMesh );
        }

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
        renderer.context;

        // Update force material
        var forceMaterial = this.materials.force;
        if(!forceMaterial){
            forceMaterial = this.materials.force = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    cellSize: { value: new THREE__namespace.Vector3(this.radius*2,this.radius*2,this.radius*2) },
                    gridPos: { value: this.broadphase.position },
                    posTex:  { value: null },
                    particlePosRelative:  { value: null },
                    velTex:  { value: null },
                    bodyAngularVelTex:  { value: null },
                    gridTex:  { value: this.textures.grid.texture },
                    params1: { value: this.params1 },
                    params2: { value: this.params2 },
                    params3: { value: this.params3 },
                },
                vertexShader: passThroughVert,
                fragmentShader: getShader( 'updateForceFrag' ),
                defines: this.getDefines()
            });
        }

        // Update particle forces / collision reaction
        buffers.depth.setTest( false );
        buffers.stencil.setTest( false );
        this.fullscreenQuad.material = this.materials.force;
        forceMaterial.uniforms.posTex.value = this.textures.particlePosWorld.texture;
        forceMaterial.uniforms.particlePosRelative.value = this.textures.particlePosRelative.texture;
        forceMaterial.uniforms.velTex.value = this.textures.particleVel.texture;
        forceMaterial.uniforms.bodyAngularVelTex.value = this.textures.bodyAngularVelRead.texture;
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particleForce, false );
        forceMaterial.uniforms.posTex.value = null;
        forceMaterial.uniforms.particlePosRelative.value = null;
        forceMaterial.uniforms.velTex.value = null;
        forceMaterial.uniforms.bodyAngularVelTex.value = null;
        this.fullscreenQuad.material = null;
    },

    // Update particle torques / collision reaction
    updateParticleTorque: function(){
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        renderer.context;

        // Update torque material
        var updateTorqueMaterial = this.materials.updateTorque;
        if(!updateTorqueMaterial){
            updateTorqueMaterial = this.materials.updateTorque = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    cellSize: { value: new THREE__namespace.Vector3(this.radius*2, this.radius*2, this.radius*2) },
                    gridPos: { value: this.broadphase.position },
                    posTex:  { value: null },
                    particlePosRelative:  { value: null },
                    velTex:  { value: null },
                    bodyAngularVelTex:  { value: null },
                    gridTex:  { value: null },
                    params1: { value: this.params1 },
                    params2: { value: this.params2 },
                    params3: { value: this.params3 },
                },
                vertexShader: passThroughVert,
                fragmentShader: getShader( 'updateTorqueFrag' ),
                defines: this.getDefines()
            });
        }

        buffers.depth.setTest( false );
        buffers.stencil.setTest( false );
        this.fullscreenQuad.material = this.materials.updateTorque;
        updateTorqueMaterial.uniforms.gridTex.value = this.textures.grid.texture;
        updateTorqueMaterial.uniforms.posTex.value = this.textures.particlePosWorld.texture;
        updateTorqueMaterial.uniforms.particlePosRelative.value = this.textures.particlePosRelative.texture;
        updateTorqueMaterial.uniforms.velTex.value = this.textures.particleVel.texture;
        updateTorqueMaterial.uniforms.bodyAngularVelTex.value = this.textures.bodyAngularVelRead.texture; // Angular velocity for indivitual particles and bodies are the same
        renderer.render( this.scenes.fullscreen, this.fullscreenCamera, this.textures.particleTorque, false );
        updateTorqueMaterial.uniforms.posTex.value = null;
        updateTorqueMaterial.uniforms.particlePosRelative.value = null;
        updateTorqueMaterial.uniforms.velTex.value = null;
        updateTorqueMaterial.uniforms.bodyAngularVelTex.value = null; // Angular velocity for indivitual particles and bodies are the same
        updateTorqueMaterial.uniforms.gridTex.value = null;
        this.fullscreenQuad.material = null;
    },

    updateBodyForce: function(){
        var renderer = this.renderer;
        var buffers = renderer.state.buffers;
        renderer.context;

        // Add force to body material
        var addForceToBodyMaterial = this.materials.addForceToBody;
        if(!addForceToBodyMaterial){
            addForceToBodyMaterial = this.materials.addForceToBody = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    relativeParticlePosTex:  { value: null },
                    particleForceTex:  { value: null }
                },
                vertexShader: getShader( 'addParticleForceToBodyVert' ),
                fragmentShader: getShader( 'addParticleForceToBodyFrag' ),
                defines: this.getDefines(),
                blending: THREE__namespace.AdditiveBlending,
                transparent: true
            });

            // Scene for mapping the particle force to bodies - one GL_POINT for each particle
            this.scenes.mapParticlesToBodies = new THREE__namespace.Scene();
            var mapParticleToBodyGeometry = new THREE__namespace.BufferGeometry();
            var numParticles = this.textures.particlePosLocal.width;
            var bodyIndices = new Float32Array( numParticles * numParticles );
            var particleIndices = new Float32Array( numParticles * numParticles );
            for(var i=0; i<numParticles * numParticles; i++){
                var particleId = i;
                particleIndices[i] = particleId;
                bodyIndices[i] = this.getBodyId(particleId);
            }
            mapParticleToBodyGeometry.addAttribute( 'position', new THREE__namespace.BufferAttribute( new Float32Array(numParticles*numParticles*3), 3 ) );
            mapParticleToBodyGeometry.addAttribute( 'particleIndex', new THREE__namespace.BufferAttribute( particleIndices, 1 ) );
            mapParticleToBodyGeometry.addAttribute( 'bodyIndex', new THREE__namespace.BufferAttribute( bodyIndices, 1 ) );
            this.mapParticleToBodyMesh = new THREE__namespace.Points( mapParticleToBodyGeometry, addForceToBodyMaterial );
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
            addTorqueToBodyMaterial = this.materials.addTorqueToBody = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    relativeParticlePosTex: { value: null },
                    particleForceTex: { value: null },
                    particleTorqueTex: { value: null }
                },
                vertexShader: getShader( 'addParticleTorqueToBodyVert' ),
                fragmentShader: getShader( 'addParticleForceToBodyFrag' ), // reuse
                defines: this.getDefines(),
                blending: THREE__namespace.AdditiveBlending,
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
            updateBodyVelocityMaterial = this.materials.updateBodyVelocity = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    linearAngular:  { type: 'f', value: 0.0 },
                    bodyQuatTex:  { value: null },
                    bodyForceTex:  { value: null },
                    bodyVelTex:  { value: null },
                    bodyMassTex:  { value: null },
                    params2: { value: this.params2 },
                    gravity:  { value: this.gravity },
                    maxVelocity: { value: this.maxVelocity }
                },
                vertexShader: passThroughVert,
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
            updateBodyPositionMaterial = this.materials.updateBodyPosition = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    bodyPosTex:  { value: null },
                    bodyVelTex:  { value: null },
                    params2: { value: this.params2 }
                },
                vertexShader: passThroughVert,
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
            updateBodyQuaternionMaterial = this.materials.updateBodyQuaternion = new THREE__namespace.ShaderMaterial({
                uniforms: {
                    bodyQuatTex: { value: null },
                    bodyAngularVelTex: { value: null },
                    params2: { value: this.params2 }
                },
                vertexShader: passThroughVert,
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
    },

    getSpherePosition: function(sphereIndex, out){
        if(sphereIndex !== 0) throw new Error("Multiple spheres not supported yet");
        out.x = this.params3.x;
        out.y = this.params3.y;
        out.z = this.params3.z;
    }
});

function createRenderTarget(w,h,type,format){
    return new THREE__namespace.WebGLRenderTarget(w, h, {
        minFilter: THREE__namespace.NearestFilter,
        magFilter: THREE__namespace.NearestFilter,
        format: THREE__namespace.RGBAFormat ,
        type: type
    });
}

exports.World = World;
