uniform vec4 params1;
#define stiffness params1.x
#define damping params1.y
#define radius params1.z
uniform vec4 params2;
#define friction params2.y

uniform vec3 cellSize;
uniform vec3 gridPos;

uniform sampler2D posTex;
uniform sampler2D particlePosRelative;
uniform sampler2D velTex;
uniform sampler2D bodyAngularVelTex;
uniform sampler2D gridTex;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    int particleIndex = uvToIndex(uv, resolution);

    // Get id and position of current particle
    vec4 positionAndBodyId = texture2D(posTex, uv);
    vec3 position = positionAndBodyId.xyz;
    float bodyId = positionAndBodyId.w;

    // Get local particle position
    vec4 relativePositionAndBodyId = texture2D(particlePosRelative, uv);
    vec3 relativePosition = relativePositionAndBodyId.xyz;

    vec3 velocity = texture2D(velTex, uv).xyz;
    vec3 angularVelocity = texture2D(bodyAngularVelTex, indexToUV(bodyId, bodyTextureResolution)).xyz;
    vec3 particleGridPos = worldPosToGridPos(position, gridPos, cellSize);
    ivec3 iGridRes = ivec3(gridResolution);

    vec3 torque = vec3(0);

    // Neighbor friction
    for(int i=-1; i<2; i++){
        for(int j=-1; j<2; j++){
            for(int k=-1; k<2; k++){
                vec3 neighborCellGridPos = particleGridPos + vec3(i,j,k);
                ivec3 iNeighborCellGridPos = ivec3(particleGridPos) + ivec3(i,j,k);
                for(int l=0; l<4; l++){
                    vec2 neighborCellTexUV = gridPosToGridUV(neighborCellGridPos, l, gridResolution, gridTextureResolution, gridZTiling);
                    neighborCellTexUV += vec2(0.5) / (2.0 * gridTextureResolution);
                    int neighborIndex = int(floor(texture2D(gridTex, neighborCellTexUV).x-1.0 + 0.5));
                    vec2 neighborUV = indexToUV(float(neighborIndex), resolution);
                    vec4 neighborPositionAndBodyId = texture2D(posTex, neighborUV);
                    vec3 neighborPosition = neighborPositionAndBodyId.xyz;
                    float neighborBodyId = neighborPositionAndBodyId.w;
                    vec3 neighborVelocity = texture2D(velTex, neighborUV).xyz;
                    vec3 neighborAngularVelocity = texture2D(bodyAngularVelTex, neighborUV).xyz;
                    vec3 neighborRelativePosition = texture2D(particlePosRelative, neighborUV).xyz;
                    if(neighborIndex >= 0 && neighborIndex != particleIndex && neighborBodyId != bodyId && iNeighborCellGridPos.x>=0 && iNeighborCellGridPos.y>=0 && iNeighborCellGridPos.z>=0 && iNeighborCellGridPos.x<iGridRes.x && iNeighborCellGridPos.y<iGridRes.y && iNeighborCellGridPos.z<iGridRes.z){
                        // Apply contact torque from neighbor
                        vec3 r = position - neighborPosition;
                        float len = length(r);
                        if(len > 0.0 && len < radius * 2.0){
                            vec3 dir = normalize(r);
                            vec3 relVel = (velocity - cross(relativePosition + radius * dir, angularVelocity)) - (neighborVelocity - cross(neighborRelativePosition + radius * (-dir), neighborAngularVelocity));

                            vec3 relTangentVel = relVel - dot(relVel, dir) * dir;
                            torque += friction * cross(relativePosition + radius * dir, relTangentVel);
                        }
                    }
                }
            }
        }
    }
    // Friction against walls
    vec3 boxMin = vec3(-boxSize.x, 0.0, -boxSize.z);
    vec3 boxMax = vec3(boxSize.x, boxSize.y*0.5, boxSize.z);
    vec3 dirs[3];
    dirs[0] = vec3(1,0,0);
    dirs[1] = vec3(0,1,0);
    dirs[2] = vec3(0,0,1);
    for(int i=0; i<3; i++){
        vec3 dir = dirs[i];
        vec3 v = velocity - cross(relativePosition + radius * dir, angularVelocity);
        if(dot(dir,position) - radius < boxMin[i]){
            vec3 relTangentVel = (v - dot(v, dir) * dir);
            torque += friction * cross(relativePosition + radius * dir, relTangentVel);
        }
        if(dot(dir,position) + radius > boxMax[i]){
            dir = -dir;
            vec3 relTangentVel = v - dot(v, dir) * dir;
            torque += friction * cross(relativePosition + radius * dir, relTangentVel);
        }
    }
    gl_FragColor = vec4(torque, 0.0);
}