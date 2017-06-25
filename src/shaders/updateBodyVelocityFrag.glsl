// Should be possible to use for both angular and linear velocity
uniform sampler2D bodyQuatTex;
uniform sampler2D bodyVelTex;
uniform sampler2D bodyForceTex;
uniform sampler2D bodyMassTex;
uniform float linearAngular;
uniform vec3 gravity;
uniform vec3 maxVelocity;
uniform vec4 params2;
#define deltaTime params2.x
#define drag params2.z

void main() {
    vec2 uv = gl_FragCoord.xy / bodyTextureResolution;
    vec4 velocity = texture2D(bodyVelTex, uv);
    vec4 force = texture2D(bodyForceTex, uv);
    vec4 quat = texture2D(bodyQuatTex, uv);
    vec4 massProps = texture2D(bodyMassTex, uv);
    vec3 newVelocity = velocity.xyz;
    if( linearAngular < 0.5 ){
        float invMass = massProps.w;
        newVelocity += (force.xyz + gravity) * deltaTime * invMass;
    } else {
        vec3 invInertia = massProps.xyz;
        newVelocity += force.xyz * deltaTime * invInertiaWorld(quat, invInertia);
    }
    newVelocity = clamp(newVelocity, -maxVelocity, maxVelocity);

    // Apply damping
    newVelocity *= pow(1.0 - drag, deltaTime);

    gl_FragColor = vec4(newVelocity, 1.0);
}