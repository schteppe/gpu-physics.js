varying float vParticleIndex;
void main() {
    gl_FragColor = vec4( vParticleIndex+1.0, 0, 0, 1 ); // indices are stored incremented by 1
}