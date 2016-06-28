'use strict';

var gulp = require('gulp');
var gulpif = require('gulp-if');
var babel = require('gulp-babel');
var logging = require('plylog');
var mergeStream = require('merge-stream');

var polymer = require('../../lib/polymer-build');

logging.setVerbose();

var PolymerProject = polymer.PolymerProject;
var fork = polymer.forkStream;

var project = new PolymerProject({
  root: process.cwd(),
  entrypoint: 'index.html',
  shell: 'src/psk-app/psk-app.html'
});

gulp.task('test1', function () {

  // process source files in the project
  var sources = project.sources().pipe(project.splitHtml()).pipe(gulpif('*.js', babel({ presets: ['es2015'] })))
  // add compilers or optimizers here!
  // TODO(justinfagnani): add in default optimizer passes
  .pipe(project.rejoinHtml());

  // process dependencies
  var dependencies = project.dependencies().pipe(project.splitHtml())
  // add compilers or optimizers here!
  // TODO(justinfagnani): add in default optimizer passes
  .pipe(project.rejoinHtml());

  // merge the source and dependencies streams to we can analyze the project
  var allFiles = mergeStream(sources, dependencies).pipe(project.analyze);

  // fork the stream in case downstream transformers mutate the files
  // this fork will vulcanize the project
  var bundled = fork(allFiles).pipe(project.bundle)
  // write to the bundled folder
  // TODO(justinfagnani): allow filtering of files before writing
  .pipe(gulp.dest('build/bundled'));

  var unbundled = fork(allFiles)
  // write to the unbundled folder
  // TODO(justinfagnani): allow filtering of files before writing
  .pipe(gulp.dest('build/unbundled'));

  return mergeStream(bundled, unbundled);
});