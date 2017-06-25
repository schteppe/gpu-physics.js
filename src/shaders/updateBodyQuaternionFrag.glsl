uniform sampler2D bodyQuatTex;
uniform sampler2D bodyAngularVelTex;
uniform vec4 params2;
#define deltaTime params2.x

void main() {
	vec2 uv = gl_FragCoord.xy / bodyTextureResolution;
	vec4 quat = texture2D(bodyQuatTex, uv);
	vec3 angularVel = texture2D(bodyAngularVelTex, uv).xyz;
	gl_FragColor = quat_integrate(quat, angularVel, deltaTime);
}