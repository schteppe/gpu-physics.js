uniform vec2 res;
uniform float quadrant;
void main() {
	vec2 coord = floor(gl_FragCoord.xy);
	if(mod(coord.x,2.0) + 2.0 * mod(coord.y,2.0) == quadrant){
		gl_FragColor = vec4(1,1,1,1);
	} else {
		discard;
	}
}