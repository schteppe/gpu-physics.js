import glsl from './src/rollup.glsl.js';

export default {
	input: 'src/index.js',
	plugins: [
		glsl()
	],
	output: [
		{
			format: 'umd',
			name: 'gp',
			file: 'build/gp.js',
			globals: {
				"three": "THREE"
			}
		},
		{
			format: 'cjs',
			file: 'build/gp.module.js'
		}
	],
	external: [ 'three' ],
};
