'use strict'

var gulp = require('gulp')

gulp.task('default', ['test'])

var transpiler = require('es6-module-transpiler')
var Container = transpiler.Container
var FileResolver = transpiler.FileResolver

var CommonJSFormatter = transpiler.formatters.commonjs
gulp.task('build', function() {
  var container = new Container({
    resolvers: [new FileResolver(['src/'])],
    formatter: new CommonJSFormatter()
  })

  container.getModule('index.js')
  container.getModule('utils.js')
  container.write('lib/')
})

var BundleFormatter = transpiler.formatters.bundle
gulp.task('bundle', function() {
  var container = new Container({
    resolvers: [new FileResolver(['src/'])],
    formatter: new BundleFormatter()
  })

  container.getModule('browser.js')
  container.write('dist/nested-observe.js')
})

var mocha = require('gulp-mocha')
gulp.task('test', ['build'], function() {
  return gulp.src(['!test/coverage/**', 'test/**/*.js'], { read: false })
             .pipe(mocha({
               reporter: 'spec'
             }))
})

var eslint = require('gulp-eslint')
gulp.task('lint', function() {
  return gulp.src(['src/**/*.js', '!test/coverage/**', 'test/**/*.js', 'gulpfile.js'])
             .pipe(eslint())
             .pipe(eslint.format())
             .pipe(eslint.failOnError())
})

var istanbul = require('gulp-istanbul')
gulp.task('coverage', function(done) {
  gulp.src(['lib/**/*.js'])
      .pipe(istanbul())
      .on('finish', function () {
        gulp.src(['!test/coverage/**', 'test/**/*.js'])
          .pipe(mocha(), { read: false })
          .pipe(istanbul.writeReports({
            dir: './test/coverage'
          }))
          .on('end', done)
      })
})

var coveralls = require('gulp-coveralls')
gulp.task('coveralls', ['coverage'], function() {
  return gulp.src('test/coverage/**/lcov.info')
             .pipe(coveralls())
})
