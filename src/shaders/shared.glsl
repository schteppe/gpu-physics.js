int uvToIndex(vec2 uv, vec2 size) {
	ivec2 coord = ivec2(floor(uv*size+0.5));
	return coord.x + int(size.x) * coord.y;
}
vec2 indexToUV(float index, vec2 res){
	vec2 uv = vec2(mod(index/res.x,1.0), floor( index/res.y ) / res.x);
	return uv;
}
// Get grid position as a vec3: (xIndex, yIndex, zIndex)
vec3 worldPosToGridPos(vec3 particlePos, vec3 gridPos, vec3 cellSize){
	return floor((particlePos - gridPos)/cellSize);
}
// Convert grid position to UV coord in the grid texture
vec2 gridPosToGridUV(vec3 gridPos, int subIndex, vec3 gridRes, vec2 gridTextureRes, vec2 gridZTile){
	gridPos = clamp(gridPos, vec3(0), gridRes-vec3(1)); // Keep within limits

	vec2 gridUV = 2.0 * gridPos.xz / gridTextureRes;

	// move to correct z square
	vec2 zPos = vec2( mod(gridPos.y, gridZTile.x), floor(gridPos.y / gridZTile.y) );
	zPos /= gridZTile;
	gridUV += zPos;

	// Choose sub pixel
	float fSubIndex = float(subIndex);
	gridUV += vec2( mod(fSubIndex,2.0), floor(fSubIndex/2.0) ) / gridTextureRes;

	return gridUV;
}
// Integrate a quaternion using an angular velocity and deltatime
vec4 quat_integrate(vec4 q, vec3 w, float dt){
	float half_dt = dt * 0.5;

	q.x += half_dt * (w.x * q.w + w.y * q.z - w.z * q.y); // TODO: vectorize
	q.y += half_dt * (w.y * q.w + w.z * q.x - w.x * q.z);
	q.z += half_dt * (w.z * q.w + w.x * q.y - w.y * q.x);
	q.w += half_dt * (- w.x * q.x - w.y * q.y - w.z * q.z);

	return normalize(q);
}

// Rotate a vector by a quaternion
vec3 vec3_applyQuat(vec3 v, vec4 q){
	float ix =  q.w * v.x + q.y * v.z - q.z * v.y; // TODO: vectorize
	float iy =  q.w * v.y + q.z * v.x - q.x * v.z;
	float iz =  q.w * v.z + q.x * v.y - q.y * v.x;
	float iw = -q.x * v.x - q.y * v.y - q.z * v.z;

	return vec3(
		ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
		iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
		iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
	);
}

mat3 transpose2( const in mat3 v ) {
	mat3 tmp;
	tmp[0] = vec3(v[0].x, v[1].x, v[2].x);
	tmp[1] = vec3(v[0].y, v[1].y, v[2].y);
	tmp[2] = vec3(v[0].z, v[1].z, v[2].z);
	return tmp;
}

mat3 quat2mat(vec4 q){
	float x = q.x;
	float y = q.y;
	float z = q.z;
	float w = q.w;

	float x2 = x + x;
	float y2 = y + y;
	float z2 = z + z;

	float xx = x * x2;
	float xy = x * y2;
	float xz = x * z2;
	float yy = y * y2;
	float yz = y * z2;
	float zz = z * z2;
	float wx = w * x2;
	float wy = w * y2;
	float wz = w * z2;

	return mat3(
		1.0 - ( yy + zz ),  xy - wz,            xz + wy,
		xy + wz,            1.0 - ( xx + zz ),  yz - wx,
		xz - wy,            yz + wx,            1.0 - ( xx + yy )
	);
}

mat3 invInertiaWorld(vec4 q, vec3 invInertia){
	mat3 R = quat2mat(q);
	mat3 I = mat3(
		invInertia.x, 0, 0,
		0, invInertia.y, 0,
		0, 0, invInertia.z
	);
	return transpose2(R) * I * R;
}

vec4 quat_slerp(vec4 v0, vec4 v1, float t){
	float d = dot(v0, v1);

	if (abs(d) > 0.9995) {
		return normalize(mix(v0,v1,t));
	}

	if (d < 0.0) {
		v1 = -v1;
		d = -d;
	}
	d = clamp(d, -1.0, 1.0);
	float theta0 = acos(d);
	float theta = theta0*t;

	vec4 v2 = normalize(v1 - v0*d);

	return v0*cos(theta) + v2*sin(theta);
}
