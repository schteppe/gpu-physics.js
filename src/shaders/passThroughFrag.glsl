uniform sampler2D texture;
uniform vec2 res;
void main() {
	vec2 uv = gl_FragCoord.xy / res;
	gl_FragColor = texture2D( texture, uv );
}