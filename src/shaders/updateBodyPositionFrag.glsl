uniform sampler2D bodyPosTex;
uniform sampler2D bodyVelTex;
uniform vec4 params2;
#define deltaTime params2.x
void main() {
	vec2 uv = gl_FragCoord.xy / bodyTextureResolution;
	vec4 posTexData = texture2D(bodyPosTex, uv);
	vec3 position = posTexData.xyz;
	vec3 velocity = texture2D(bodyVelTex, uv).xyz;
	gl_FragColor = vec4(position + velocity * deltaTime, 1.0);
}