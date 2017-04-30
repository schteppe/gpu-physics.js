GPU Rigid Bodies in Three.js
============================

[Launch demo](https://schteppe.github.io/threejs-gpu-physics/)

![Demo](https://cloud.githubusercontent.com/assets/1063152/25567729/a1e103c8-2df4-11e7-9e74-4242b5d9ea55.png)

## About

The demo is largely based on [GPU Gems 3 ch. 29, Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch29.html). The simulation loop is in short:

<ol>
<li>Create float render targets of size N*N for bodies: position, quaternion, force, torque</li>
<li>Create float render targets of size M*M for particles: local position, world position, relative position, force</li>
<li>Create float render targets of size 4*M*M for a broadphase grid</li>
<li>While running:</li>
<ol>
<li>Calculate particle properties: world positions, body-relative positions, velocities.</li>
<li>Set up "broadphase render target". Stencil buffer is set up for stencil routing (see <a href="http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf">this presentation, slide 24</a>) by clearing once (to set stencil values to zero) and drawing point clouds thrice to set values 1, 2 and 3 into the stencil buffer.</li>
<li>Particles are drawn to the "broadphase render target" using GL_POINTS with point-size 2. This maps them into the correct "grid bucket" and writes the particle ID's there.</li>
<li>Particle forces are calculated using spring-and-dashpot model equations. Neighboring particles are easily looked up in the broadphase render target.</li>
<li>Forces are added to the bodies' force render target using `GL_POINTS` with additive blending.</li>
<li>Torque is added to bodies' torque render target in the same way.</li>
<li>Body velocities are updated: `velocity += deltaTime * force / inertia`.</li>
<li>Body positions are updated: `position += deltaTime * velocity`.</li>
</ol>
