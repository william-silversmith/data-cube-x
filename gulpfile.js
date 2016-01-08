var argv = require('yargs').argv,
	gulp = require('gulp'),
	babel = require("gulp-babel");

var fs = require('fs');

gulp.task('default', [ 'js' ]);

gulp.task('js', function () {
	return gulp.src('./datacube.es6')
		.pipe(babel({
			presets: [ 'es2015' ],
		}))
		.pipe(gulp.dest('./'));
});

gulp.task('watch', function () {
	gulp.watch([
		'./datacube.es6'
	], [ 'js' ]);
});
