'use strict'

var expect = require('chai').expect
var Nested = require('../')
Nested.debug = true

var records
function observer(recs) {
  records = recs
}

function clearChanges() {
  Nested.deliverChangeRecords(observer)
  records = undefined
}

function assertChangesAre(expectation) {
  if (expectation && !Array.isArray(expectation)) {
    expectation = [expectation]
  }
  Nested.deliverChangeRecords(observer)
  expect(records).to.eql(expectation)
  records = undefined
}

var obj, arr
beforeEach(function() {
  obj = {}
  arr = []
  Nested.observe(obj, observer)
  Nested.observe(arr, observer)
})

afterEach(function() {
  Nested.unobserve(obj, observer)
  Nested.unobserve(arr, observer)
})

describe('Flat', function() {
  describe('.observe({Object})', function() {
    it('should work for `add`', function() {
      obj.foo = 'bar'
      assertChangesAre({
        object: obj, type: 'add', name: 'foo',
        root: obj, path: '/foo'
      })
    })

    it('should work for `update`', function() {
      obj.count = 0
      clearChanges()

      obj.count++
      assertChangesAre({
        object: obj, type: 'update', name: 'count', oldValue: 0,
        root: obj, path: '/count'
      })
    })

    it('should work for `delete`', function() {
      obj.foo = 'bar'
      clearChanges()

      delete obj.foo
      assertChangesAre({
        object: obj, type: 'delete', name: 'foo', oldValue: 'bar',
        root: obj, path: '/foo'
      })
    })

    it('should work for `reconfigure`', function() {
      obj.foo = 'bar'
      clearChanges()

      Object.defineProperty(obj, 'foo', { writable: false })
      assertChangesAre({
        object: obj, type: 'reconfigure', name: 'foo',
        root: obj, path: '/foo'
      })
    })

    it('should work for `setPrototype`')
    it('should work for `preventExtensions`')
  })

  describe('.observe({Array))', function() {
    it('should work for .push()', function() {
      arr.push(1)
      assertChangesAre({
        object: arr, type: 'splice', index: 0, removed: [], addedCount: 1,
        root: arr, path: '/0'
      })
    })

    it('should work for .splice()', function() {
      arr.push(1, 2, 3, 4)
      clearChanges()

      arr.splice(2, 2)
      assertChangesAre({
        object: arr, type: 'splice', index: 2, removed: [3, 4], addedCount: 0,
        root: arr, path: '/2'
      })
    })

    it('should work for index assignment', function() {
      arr.push(1, 2)
      clearChanges()

      arr[4] = 5
      assertChangesAre({
        object: arr, type: 'splice', index: 2, removed: [], addedCount: 3,
        root: arr, path: '/2'
      })
    })

    it('should work for length assignment', function() {
      arr.push(1, 2)
      clearChanges()

      arr.length = 0
      assertChangesAre({
        object: arr, type: 'splice', index: 0, removed: [1, 2], addedCount: 0,
        root: arr, path: '/0'
      })
    })
  })

  describe('.unobserve()', function() {
    it('should work', function() {
      obj.foo = 'bar'
      clearChanges()

      Nested.unobserve(obj, observer)
      obj.foo = 'baaaaar'
      assertChangesAre(undefined)
    })
  })
})

describe('Nested', function() {
  describe('.observe()', function() {
    it('should not throw if called multiple times', function() {
      Nested.observe(obj, observer)
    })

    it('should observe deeply', function() {
      obj.deep = { first: { second: {} }, nonobj: 42 }
      clearChanges()

      obj.deep.first.second.third = {}
      assertChangesAre({
        object: obj.deep.first.second, type: 'add', name: 'third',
        path: '/deep/first/second/third', root: obj
      })
    })

    it('should observe added objects', function() {
      var deep = obj.deep = {}
      clearChanges()

      deep.foo = 'bar'
      assertChangesAre({
        object: deep, type: 'add', name: 'foo',
        path: '/deep/foo', root: obj
      })
    })

    it('should observe updated objects', function() {
      obj.deep = {}
      clearChanges()

      var after = obj.deep = { deeper: {} }
      clearChanges()

      after.deeper.foo = 'bar'
      assertChangesAre({
        object: after.deeper, type: 'add', name: 'foo',
        path: '/deep/deeper/foo', root: obj
      })
    })

    it('should unobserve replaced objects', function() {
      var before = obj.deep = { deeper: {} }
      clearChanges()

      obj.deep = {}
      clearChanges()

      before.deeper.foo = 'bar'
      assertChangesAre(undefined)
    })

    it('should unobserve deleted objects', function() {
      var deep = obj.deep = { deeper: {} }
      clearChanges()

      delete obj.deep
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre(undefined)
    })

    it('should unobserve reconfigured objects (enumerable = false)', function() {
      var deep = obj.deep = { deeper: {} }
      clearChanges()

      Object.defineProperty(deep, 'deeper', { enumerable: false })
      assertChangesAre({
        object: deep, type: 'reconfigure', name: 'deeper',
        root: obj, path: '/deep/deeper'
      })

      deep.deeper.foo = 'bar'
      assertChangesAre(undefined)
    })

    it('should properly recognize moved objects', function() {
      var deep = obj.first = { deeper: {} }
      clearChanges()

      obj.second = deep
      delete obj.first
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'foo',
        path: '/second/deeper/foo', root: obj
      })
    })

    it('should properly recognize objects that occure multiple times (1)', function() {
      var deep = { deeper: {} }
      obj.first = deep
      obj.second = { deep: deep }
      clearChanges()

      delete obj.first
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'foo',
        path: '/second/deep/deeper/foo', root: obj
      })
    })

    it('should properly recognize objects that occure multiple times (2)', function() {
      var deep = { deeper: {} }
      obj.first = deep
      obj.second = { deep: deep }
      clearChanges()

      delete obj.second
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'foo',
        path: '/first/deeper/foo', root: obj
      })
    })

    it('should properly recognize objects that occure multiple times (3)', function() {
      var first = obj
      first.name = 'first'

      var second = {}
      second.name = 'second'
      Nested.observe(second, observer)

      var deep = { deeper: {} }
      first.deep = deep
      second.deep = deep
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre([
        {
          object: deep.deeper, type: 'add', name: 'foo',
          path: '/deep/deeper/foo', root: first
        },
        {
          object: deep.deeper, type: 'add', name: 'foo',
          path: '/deep/deeper/foo', root: second
        }
      ])
    })

    it('should properly cleanup objects that occured multiple times', function() {
      var deep = { deeper: {} }
      obj.first = deep
      obj.second = { deep: deep }
      clearChanges()

      delete obj.first
      delete obj.second
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre(undefined)
    })

    it('should ignore circular references (1)', function() {
      var deep = { deeper: {} }
      obj.deep = deep
      deep.deeper.deep = deep
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'foo',
        path: '/deep/deeper/foo', root: obj
      })
    })

    it('should ignore circular references (2)', function() {
      var deep = { deeper: {} }
      obj.deep = deep
      clearChanges()

      deep.deeper.deep = deep
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'deep',
        path: '/deep/deeper/deep', root: obj
      })

      deep.deeper.foo = 'bar'
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'foo',
        path: '/deep/deeper/foo', root: obj
      })
    })

    it('should observe objects added to an array', function() {
      obj.arr = []
      clearChanges()

      var deep = { deeper: {} }
      obj.arr.push({ deep: deep })
      assertChangesAre({
        object: obj.arr, type: 'splice', index: 0, removed: [], addedCount: 1,
        root: obj, path: '/arr/0'
      })

      deep.deeper.foo = 'bar'
      assertChangesAre({
        object: deep.deeper, type: 'add', name: 'foo',
        path: '/arr/0/deep/deeper/foo', root: obj
      })
    })

    it('should unobserve objects removed from an array', function() {
      obj.arr = []
      var deep = { deeper: {} }
      obj.arr.push({ deep: deep })
      clearChanges()

      obj.arr.splice(0, 1)
      clearChanges()

      deep.deeper.foo = 'bar'
      assertChangesAre(undefined)
    })
  })

  describe('.unobserve()', function() {
    it('should work', function() {
      obj.deep = { first: { second: {} } }
      clearChanges()

      Nested.unobserve(obj, observer)

      obj.deep.first.second.third = {}
      assertChangesAre(undefined)
    })

    it('should not throw for unobserved callback', function() {
      Nested.unobserve(obj, console.log)
    })

    it('should not throw for unobserved objects', function() {
      Nested.unobserve({}, observer)
    })
  })

  describe('.deliverChangeRecords()', function() {
    it('should not throw for unobserved callback', function() {
      Nested.deliverChangeRecords(console.log)
    })

    it('should throw when called with a non-function', function() {
      expect(function() {
        Nested.deliverChangeRecords()
      }).to.throw('Callback must be a function, given: undefined')
    })
  })

  describe('debug', function() {
    var error = console.error
    after(function() {
      console.error = error
    })

    it('should log if enabled', function(done) {
      var test = {}
      var observer = function() {
        Object.undefined.is.not.a.function
      }

      Nested.observe(test, observer)

      var called = false
      console.error = function() {
        called = true
      }
      test.foo = 'bar'
      clearChanges()

      setImmediate(function() {
        expect(called).to.be.true
        Nested.unobserve(test, observer)
        done()
      })
    })

    it('should be silent if disabled', function(done) {
      var test = {}
      var observer = function() {
        Object.undefined.is.not.a.function
      }

      Nested.observe(test, observer)
      Nested.debug = false

      var called = false
      console.error = function() {
        called = true
      }
      test.foo = 'bar'
      clearChanges()

      setImmediate(function() {
        expect(called).to.be.false
        Nested.unobserve(test, observer)
        Nested.debug = true
        done()
      })
    })
  })
})
