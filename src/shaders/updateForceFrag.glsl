uniform vec4 params1;
#define stiffness params1.x
#define damping params1.y
#define radius params1.z
uniform vec4 params2;
#define friction params2.y

uniform vec4 params3;
#define interactionSpherePos params3.xyz
#define interactionSphereRadius params3.w

uniform vec3 cellSize;
uniform vec3 gridPos;

uniform sampler2D posTex;
uniform sampler2D velTex;
uniform sampler2D bodyAngularVelTex;
uniform sampler2D particlePosRelative;
uniform sampler2D gridTex;

vec3 particleForce(float STIFFNESS, float DAMPING, float DAMPING_T, float distance, float minDistance, vec3 xi, vec3 xj, vec3 vi, vec3 vj){
    vec3 rij = xj - xi;
    vec3 rij_unit = normalize(rij);
    vec3 vij = vj - vi;
    vec3 vij_t = vij - dot(vij, rij_unit) * rij_unit;
    vec3 springForce = - STIFFNESS * (distance - max(length(rij), minDistance)) * rij_unit;
    vec3 dampingForce = DAMPING * dot(vij,rij_unit) * rij_unit;
    vec3 tangentForce = DAMPING_T * vij_t;
    return springForce + dampingForce + tangentForce;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    int particleIndex = uvToIndex(uv, resolution);

    // Get id and position of current
    vec4 positionAndBodyId = texture2D(posTex, uv);
    vec3 position = positionAndBodyId.xyz;
    float bodyId = positionAndBodyId.w;
    vec3 velocity = texture2D(velTex, uv).xyz;
    vec3 particleGridPos = worldPosToGridPos(position, gridPos, cellSize);
    vec3 bodyAngularVelocity = texture2D(bodyAngularVelTex, indexToUV(bodyId,bodyTextureResolution)).xyz;

    // Get local particle position
    vec4 relativePositionAndBodyId = texture2D(particlePosRelative, uv);
    vec3 relativePosition = relativePositionAndBodyId.xyz;

    vec3 force = vec3(0);
    ivec3 iGridRes = ivec3(gridResolution);

    // Neighbor collisions
    for(int i=-1; i<2; i++){
        for(int j=-1; j<2; j++){
            for(int k=-1; k<2; k++){
                vec3 neighborCellGridPos = particleGridPos + vec3(i,j,k);
                ivec3 iNeighborCellGridPos = ivec3(particleGridPos) + ivec3(i,j,k);
                for(int l=0; l<4; l++){
                    vec2 neighborCellTexUV = gridPosToGridUV(neighborCellGridPos, l, gridResolution, gridTextureResolution, gridZTiling);
                    neighborCellTexUV += vec2(0.5) / (2.0 * gridTextureResolution); // center to cell pixel
                    int neighborIndex = int(floor(texture2D(gridTex, neighborCellTexUV).x-1.0 + 0.5)); // indices are stored incremented by 1
                    vec2 neighborUV = indexToUV(float(neighborIndex), resolution);
                    vec4 neighborPositionAndBodyId = texture2D(posTex, neighborUV);
                    vec3 neighborPosition = neighborPositionAndBodyId.xyz;
                    float neighborBodyId = neighborPositionAndBodyId.w;
                    vec3 neighborAngularVelocity = texture2D(bodyAngularVelTex, indexToUV(neighborBodyId,bodyTextureResolution)).xyz;
                    vec3 neighborVelocity = texture2D(velTex, neighborUV).xyz;
                    vec3 neighborRelativePosition = texture2D(particlePosRelative, neighborUV).xyz;
                    if(neighborIndex >=0 && neighborIndex != particleIndex && neighborBodyId != bodyId && iNeighborCellGridPos.x>=0 && iNeighborCellGridPos.y>=0 && iNeighborCellGridPos.z>=0 && iNeighborCellGridPos.x<iGridRes.x && iNeighborCellGridPos.y<iGridRes.y && iNeighborCellGridPos.z<iGridRes.z){ // Not self!
                        // Apply contact force from neighbor
                        vec3 r = position - neighborPosition;
                        float len = length(r);
                        if(len > 0.0 && len < radius * 2.0){
                            vec3 dir = normalize(r);
                            vec3 v = velocity - cross(relativePosition + radius * dir, bodyAngularVelocity);
                            vec3 nv = neighborVelocity - cross(neighborRelativePosition + radius * (-dir), neighborAngularVelocity);
                            force += particleForce(stiffness, damping, friction, 2.0 * radius, radius, position, neighborPosition, v, nv);
                        }
                    }
                }
            }
        }
    }

    // Apply force from ground / bounds
    vec3 boxMin = vec3(-boxSize.x, 0.0, -boxSize.z);
    vec3 boxMax = vec3(boxSize.x, boxSize.y*0.5, boxSize.z);
    vec3 dirs[3];
    dirs[0] = vec3(1,0,0);
    dirs[1] = vec3(0,1,0);
    dirs[2] = vec3(0,0,1);
    for(int i=0; i<3; i++){
        vec3 dir = dirs[i];
        vec3 v = velocity - cross(relativePosition + radius * dir, bodyAngularVelocity);
        vec3 tangentVel = v - dot(v,dir) * dir;
        float x = dot(dir,position) - radius;
        if(x < boxMin[i]){
            force += -( stiffness * (x - boxMin[i]) * dir + damping * dot(v,dir) * dir);
            force -= friction * tangentVel;
        }
        x = dot(dir,position) + radius;
        if(x > boxMax[i]){
            dir = -dir;
            force -= -( stiffness * (x - boxMax[i]) * dir - damping * dot(v,dir) * dir);
            force -= friction * tangentVel;
        }
    }
    // Sphere interaction
    vec3 r = position - interactionSpherePos;
    float len = length(r);
    if(len > 0.0 && len < interactionSphereRadius+radius){
        force += particleForce(stiffness, damping, friction, radius + interactionSphereRadius, interactionSphereRadius, position, interactionSpherePos, velocity, vec3(0));
    }
    gl_FragColor = vec4(force, 1.0);
}