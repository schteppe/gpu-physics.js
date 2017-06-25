uniform sampler2D relativeParticlePosTex;
uniform sampler2D bodyVelTex;
uniform sampler2D bodyAngularVelTex;
void main() {
	vec2 particleUV = gl_FragCoord.xy / resolution;
	vec4 particlePosAndBodyId = texture2D( relativeParticlePosTex, particleUV );
	vec3 relativeParticlePosition = particlePosAndBodyId.xyz;
	float bodyIndex = particlePosAndBodyId.w;
	vec2 bodyUV = indexToUV( bodyIndex, bodyTextureResolution );
	bodyUV += vec2(0.5) / bodyTextureResolution;// center to pixel

	vec3 bodyVelocity = texture2D( bodyVelTex, bodyUV ).xyz;
	vec3 bodyAngularVelocity = texture2D( bodyAngularVelTex, bodyUV ).xyz;
	vec3 particleVelocity = bodyVelocity - cross(relativeParticlePosition, bodyAngularVelocity);

	gl_FragColor = vec4(particleVelocity, 1);
}