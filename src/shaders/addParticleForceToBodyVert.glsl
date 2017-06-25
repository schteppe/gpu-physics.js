uniform sampler2D relativeParticlePosTex;
uniform sampler2D particleForceTex;
attribute float particleIndex;
attribute float bodyIndex; // Should this be in a texture?
varying vec3 vBodyForce;
void main() {
    vec2 particleUV = indexToUV( particleIndex, resolution );
    vec3 particleForce = texture2D( particleForceTex, particleUV ).xyz;
    vBodyForce = particleForce;
    vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );
    bodyUV += vec2(0.5) / bodyTextureResolution; // center to pixel
    gl_PointSize = 1.0;
    gl_Position = vec4(2.0 * (bodyUV - 0.5), -particleIndex / (resolution.x*resolution.y), 1);
}