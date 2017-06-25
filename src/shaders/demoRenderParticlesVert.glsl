uniform sampler2D particleLocalPosTex;
uniform sampler2D posTex;
uniform sampler2D posTexPrev;
uniform sampler2D quatTex;
uniform sampler2D quatTexPrev;
uniform float interpolationValue;
attribute float particleIndex;
#define PHONG
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	vec2 particleUV = indexToUV(particleIndex,resolution);
#ifdef USE_COLOR
	vColor = vec3((floor(particleUV*3.0)+1.0)/3.0,0);
#endif
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	vec4 particlePosAndBodyId = texture2D(particleLocalPosTex,particleUV);
	vec2 bodyUV = indexToUV(particlePosAndBodyId.w,bodyTextureResolution);
	bodyUV += vec2(0.5) / bodyTextureResolution;// center to pixel

	vec4 bodyQuat = texture2D(quatTex,bodyUV).xyzw;
	vec3 bodyPos = texture2D(posTex,bodyUV).xyz;
	vec4 bodyQuatPrev = texture2D(quatTexPrev,bodyUV).xyzw;
	vec3 bodyPosPrev = texture2D(posTexPrev,bodyUV).xyz;
	bodyPos = mix(bodyPosPrev,bodyPos,interpolationValue);
	bodyQuat = quat_slerp(bodyQuatPrev,bodyQuat,interpolationValue);

	objectNormal.xyz = vec3_applyQuat(objectNormal.xyz, bodyQuat);
	vec3 particlePos = particlePosAndBodyId.xyz;
	vec3 worldParticlePos = vec3_applyQuat(particlePos, bodyQuat) + bodyPos;
#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
#endif
	#include <begin_vertex>
	transformed.xyz = vec3_applyQuat(transformed.xyz, bodyQuat);
	transformed.xyz += worldParticlePos;
	#include <displacementmap_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}