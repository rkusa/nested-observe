'use strict'

var gulp = require('gulp')

gulp.task('default', ['test'])

var transpile  = require('gulp-es6-module-transpiler')
var sourcemaps = require('gulp-sourcemaps')

gulp.task('build', function() {
  return gulp.src(['!src/browser.js', 'src/**/*.js'])
    .pipe(transpile({
      formatter: new transpile.formatters.commonjs
    }))
    .pipe(gulp.dest('lib'))
})

// var BundleFormatter = transpiler.formatters.bundle
gulp.task('bundle', function() {
  return gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
      .pipe(transpile({
        bundleName: 'nested-observe',
        formatter: new transpile.formatters.bundle
      }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('dist'))
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
