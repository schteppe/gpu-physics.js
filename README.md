GPU Rigid Bodies in Three.js
============================

[Launch demo](https://schteppe.github.io/threejs-gpu-physics/)

![Demo](https://cloud.githubusercontent.com/assets/1063152/25567729/a1e103c8-2df4-11e7-9e74-4242b5d9ea55.png)

## About

The demo is largely based on [GPU Gems 3 ch. 29, Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch29.html). The simulation loop is in short:

<ol>
<li>Initialize floating point render targets for N bodies and M particles</li>
<li>While running:</li>
<ol>
   <li>Calculate particle properties: world positions, body-relative positions, velocities.</li>
   <li>Set up "broadphase render target". Stencil buffer is set up for stencil routing see [this presentation, slide 24](http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf) by clearing once (to set stencil values to zero) and drawing point clouds thrice to set values `1`, `2` and `3` into the stencil buffer.</li>
   <li>Particles are drawn to the "broadphase render target" using `GL_POINTS` with point-size `2`.</li>
   <li>Particle forces are calculated using spring-and-dashpot model equations.</li>
   <li>Forces are added to the bodies' force render target using `GL_POINTS` with additive blending.</li>
   <li>Torque is added to bodies' torque render target in the same way.</li>
   <li>Body velocities are updated: `velocity += deltaTime * force / inertia`.</li>
   <li>Body positions are updated: `position += deltaTime * velocity`.</li>
</ol>
