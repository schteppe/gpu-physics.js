import glsl from './src/rollup.glsl.js';

export default {
	entry: 'src/demo.js',
	indent: '\t',
	plugins: [
		glsl()
	],
	targets: [
		{
			format: 'umd',
			moduleName: 'Demo',
			dest: 'build/demo.js'
		},
	],
	external: [ 'three' ],
	globals: {
		"three": "THREE"
	}
};