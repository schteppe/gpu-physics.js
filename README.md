GPU Rigid Bodies in Three.js
============================

[Launch demo](https://schteppe.github.io/threejs-gpu-physics/)

![Demo](https://cloud.githubusercontent.com/assets/1063152/25567729/a1e103c8-2df4-11e7-9e74-4242b5d9ea55.png)

## About

The demo is largely based on [GPU Gems 3 ch. 29, Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch29.html). The simulation loop is in short:

1. Initialize floating point render targets for N bodies and M particles
2. While running:
    1. Calculate particle properties: world positions, body-relative positions, velocities.
    2. Set up "broadphase render target". Stencil buffer is set up for stencil routing (see [this presentation, slide 24](http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf)) by clearing once (to set stencil values to zero) and drawing point clouds thrice (to set values 1,2,3 into the stencil buffer).
    3. Particles are drawn to the "broadphase render target" using `GL_POINTS` with point-size 2.
    4. Particle forces are calculated using spring-and-dashpot model equations.
    5. Forces are added to the bodies using additive rendering
    6. Torque is added to bodies in the same way
    7. Body velocities are updated: `velocity += deltaTime * force / inertia`
    8. Body positions are updated: `position += deltaTime * velocity`
