GPU Rigid Bodies in Three.js
============================

[Launch demo](https://schteppe.github.io/threejs-gpu-physics/)

![Demo](gpu-physics.jpg)

## About the demo

An insane amount of rigid bodies are waiting to spawn. How many can your GPU handle? Use the GUI to tweak simulation parameters or just shove the sphere into the container to see what happens.

## Implementation

The demo is largely based on [GPU Gems 3 ch. 29, Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch29.html). It heavily relies on the `THREE.WebGLRenderTarget` class and custom shaders.

The simulation loop is in short:

<ol>
<li>Create float render targets of size N*N for bodies: position, quaternion, velocity, angular velocity, force, torque.</li>
<li>Create float render targets of size M*M for particles: local position, world position, relative position, force.</li>
<li>Create float render target of size 4*M*M for a broadphase grid.</li>
<li>While running:</li>
<ol>
<li>Calculate particle properties: world position, body-relative position, velocity.</li>
<li>Set up "broadphase render target". Stencil buffer is set up for stencil routing (see <a href="http://www.gpgpu.org/static/s2007/slides/15-GPGPU-physics.pdf">this presentation, slide 24</a>) by clearing once (to set stencil values to zero) and drawing point clouds thrice to set values 1, 2 and 3 into the stencil buffer. An alternative is using PBOs to set these values, but it doesn't seem to be available in WebGL1.</li>
<li>Particles are drawn to the "broadphase render target" using GL_POINTS with point-size 2. This maps them into the correct "grid bucket" and writes the particle ID's there. The stencil routing guarantees four particle ID's can be drawn into the same grid bucket in this single draw call.</li>
<li>Particle forces are calculated using spring-and-dashpot model equations. Neighboring particles are easily looked up in the broadphase render target.</li>
<li>Forces are added to the bodies' force render target using GL_POINTS with additive blending. Other forces such as gravity is added here too.</li>
<li>Torque is added to bodies' torque render target in the same way.</li>
<li>Body velocities are updated: velocity += deltaTime * force / inertia.</li>
<li>Body positions are updated: position += deltaTime * velocity.</li>
<li>Render each body by looking up body position and quaternion in the correct render target texture.</li>
</ol>
</ol>

## Possible improvements

* Seems like a lot of the simulation loop is spent updating the stencil buffer for the large grid render target. Using PBOs and drawPixels (available in WebGL2?) could speed it up.
* Using a single channel for the grid texture could save some graphics memory.
* Balancing the dimensions of the broadphase grid texture could increase the max object count.
