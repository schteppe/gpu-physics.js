uniform sampler2D posTex;
uniform vec3 cellSize;
uniform vec3 gridPos;
attribute float particleIndex;
varying float vParticleIndex;
void main() {
    vParticleIndex = particleIndex;
    vec2 particleUV = indexToUV(particleIndex, resolution);
    vec3 particlePos = texture2D( posTex, particleUV ).xyz;
    // Get particle cell position
    vec3 cellPos = worldPosToGridPos(particlePos, gridPos, cellSize);
    vec2 gridUV = gridPosToGridUV(cellPos, 0, gridResolution, gridTextureResolution, gridZTiling);
    gridUV += vec2(1) / gridTextureResolution;// center to cell
    gl_PointSize = 2.0; // Cover 4 pixels in the grid texture
    gl_Position = vec4(2.0*(gridUV-0.5), 0, 1);
}