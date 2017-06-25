uniform sampler2D localParticlePosTex;
uniform sampler2D bodyPosTex;
uniform sampler2D bodyQuatTex;
void main() {
	vec2 uv = gl_FragCoord.xy / resolution;
	float particleIndex = float(uvToIndex(uv, resolution));
	vec4 particlePosAndBodyId = texture2D( localParticlePosTex, uv );
	vec3 particlePos = particlePosAndBodyId.xyz;

	float bodyIndex = particlePosAndBodyId.w;
	vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );
	bodyUV += vec2(0.5) / bodyTextureResolution; // center to pixel
	vec3 bodyPos = texture2D( bodyPosTex, bodyUV ).xyz;
	vec4 bodyQuat = texture2D( bodyQuatTex, bodyUV );

	vec3 worldParticlePos = vec3_applyQuat(particlePos, bodyQuat) + bodyPos;
	gl_FragColor = vec4(worldParticlePos, bodyIndex);
}