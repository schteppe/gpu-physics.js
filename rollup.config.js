import glsl from './src/rollup.glsl.js';

export default {
	entry: 'src/index.js',
	indent: '\t',
	plugins: [
		glsl()
	],
	targets: [
		{
			format: 'umd',
			moduleName: 'gp',
			dest: 'build/gp.js'
		},
		{
			format: 'cjs',
			dest: 'build/gp.module.js'
		}
	],
	external: [ 'three' ],
	globals: {
		"three": "THREE"
	}
};
