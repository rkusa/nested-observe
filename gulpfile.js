'use strict'

var gulp = require('gulp')

gulp.task('default', ['lint', 'test'])

var mocha = require('gulp-mocha')
gulp.task('test', function() {
  return gulp.src(['!test/coverage/**', 'test/**/*.js'], { read: false })
             .pipe(mocha({
               reporter: 'spec'
             }))
})

var eslint = require('gulp-eslint')
gulp.task('lint', function() {
  return gulp.src(['lib/**/*.js', '!test/coverage/**', 'test/**/*.js', 'gulpfile.js'])
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
