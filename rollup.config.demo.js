import glsl from './src/rollup.glsl.js';

export default {
	input: 'src/demo.js',
	plugins: [
		glsl()
	],
	output: [
		{
			format: 'umd',
			name: 'Demo',
			file: 'build/demo.js',
			globals: {
				"three": "THREE"
			}
		},
	],
	external: [ 'three' ],
};