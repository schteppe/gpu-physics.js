function glsl() {
	return {
		transform( code, id ) {
			if ( /\.glsl$/.test( id ) === false ) return;
			var transformedCode = 'export default ' + JSON.stringify(
				code
					.replace( /[ \t]*\/\/.*\n/g, '' ) // remove //
					.replace( /[ \t]*\/\*[\s\S]*?\*\//g, '' ) // remove /* */
					.replace( /\n{2,}/g, '\n' ) // # \n+ to \n
			) + ';';
			return {
				code: transformedCode,
				map: { mappings: '' }
			};
		}
	};
}

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
