'use strict'

var pointer = require('json-pointer')

// This weak map is used for `.deliverChangeRecords(callback)` calls, where the
// provided callback has to mapped to its corresponding delegate.
var delegates = new WeakMap // <callback, delegate>

// When using `.observe(obj, callback)`, instead of forwarding the provided
// `callback` to `Object.observe(obj, callback)` directly, a delegate for the
// `callback` is created. This delegate transforms changes before forwarding
// them to the actual `callback`.
var Delegate = function(callback) {
  this.callback  = callback
  this.observers = new WeakMap

  var self = this
  this.handleChangeRecords = function(records) {
    try {
      var changes = records.map(self.transform, self)
      changes = Array.prototype.concat.apply([], changes) // flatten
      self.callback(changes)
    } catch (err) {
      if (exports.debug) console.error(err.stack)
    }
  }
}

// This method transforms the received change record with using the
// corresponding observer for the object that got changed.
Delegate.prototype.transform = function(record) {
  var observers = this.observers.get(record.object)
  observers = observers.filter(function(value, index, self) {
    return self.indexOf(value) === index
  })
  return observers.map(function(observer) {
    return observer.transform(record)
  })
}

// Each callback/object pair gets its own observer, which is used to track
// positions of nested objects and transforms change records accordingly.
var Observer = function(root, delegate, accept) {
  this.root     = root
  this.delegate = delegate
  this.callback = delegate.handleChangeRecords
  this.accept   = accept
  this.paths    = new WeakMap
}

// Recursively observe an object and its nested objects.
Observer.prototype.observe = function(obj, path, visited) {
  if (!path)    path = ''
  if (!visited) visited = new WeakMap

  if (visited.has(obj)) {
    return
  }

  visited.set(obj, true)

  // if the object is already observed, i.e., already somewhere else in the
  // nested structure -> do not observe it again
  if (!hasAt(this.delegate.observers, obj, this)) {
    if (Array.isArray(obj) && !this.accept) {
      Object.observe(obj, this.callback, ['add', 'update', 'delete', 'splice'])
    } else {
      Object.observe(obj, this.callback, this.accept)
    }
  }

  // track path and belonging
  addAt(this.paths, obj, path)
  addAt(this.delegate.observers, obj, this)

  // traverse the properties to find nested objects and observe them, too
  for (var key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object') {
      this.observe(obj[key], path + '/' + pointer.escape(key), visited)
    }
  }
}

// Recursively unobserve an object and its nested objects.
Observer.prototype.unobserve = function(obj, path) {
  if (!obj)  obj = this.root
  if (!path) path = ''

  if (!hasAt(this.delegate.observers, obj, this)) {
    return
  }

  // clean up
  removeAt(this.paths, obj, path)
  removeAt(this.delegate.observers, obj, this)

  if (!this.paths.has(obj)) {
    Object.unobserve(obj, this.callback)
  }

  // traverse the properties to find nested objects and unobserve them, too
  for (var key in obj) {
    if (typeof obj[key] === 'object') {
      this.unobserve(obj[key], path + '/' + pointer.escape(key))
    }
  }
}

// Transform a change record, ie., add the following properties:
// - **root** - the root of the nested structure
// - **path** - a [JSON Pointer](http://tools.ietf.org/html/rfc6901)
//              (absolute from the root) to the changed property
Observer.prototype.transform = function(change) {
  var key = String(change.name || change.index)

  var path = this.paths.get(change.object)[0] + '/' + pointer.escape(key)
  var record = {
    root: this.root,
    path: path
  }

  // the original change record ist not extensible -> copy
  for (var prop in change) {
    record[prop] = change[prop]
  }

  // unobserve deleted/replaced objects
  var deleted = change.oldValue && [change.oldValue] || change.removed || []
  deleted.forEach(function(oldValue) {
    if (!oldValue || typeof oldValue !== 'object') {
      return
    }

    var invalidPaths = this.paths.get(oldValue).filter(function(path) {
      return !pointer.has(this.root, path) || pointer.get(this.root, path) !== oldValue
    }, this)

    this.unobserve(oldValue, invalidPaths[0])
  }, this)

  // observe added/updated objects
  var value = change.object[key]
  if (typeof value === 'object') {
    var desc = Object.getOwnPropertyDescriptor(change.object, key)
    if (desc.enumerable === true) {
      this.observe(value, path)
    } else {
      this.unobserve(value, path)
    }
  }

  Object.preventExtensions(record)

  return record
}

// Corresponds to `Object.observe()` but for nested objects.
exports.observe = function(obj, callback, accept) {
  var delegate

  if (!delegates.has(callback)) {
    delegate = new Delegate(callback)
    delegates.set(callback, delegate)
  } else {
    delegate = delegates.get(callback)
  }

  var observers = delegate.observers
  if (observers.has(obj)) {
    return
  }

  var observer = new Observer(obj, delegate, accept)
  observer.observe(obj)
}

// Corresponds to `Object.unobserve()` but for nested objects.
exports.unobserve = function(obj, callback) {
  if (!delegates.has(callback)) return
  var delegate = delegates.get(callback)

  if (!delegate.observers.has(obj)) {
    return
  }

  var observers = delegate.observers.get(obj)
  observers.forEach(function(observer) {
    observer.unobserve()
  })
}

// Corresponds to `Object.deliverChangeRecords()` but for nested objects.
exports.deliverChangeRecords = function(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function, given: ' + callback)
  }

  if (!delegates.has(callback)) return

  var delegate = delegates.get(callback)
  Object.deliverChangeRecords(delegate.handleChangeRecords)
}

// whether to log exceptions thrown during change record delivery
exports.debug = false

// Helper function to check if a value exists in the array at the provided
// position in the provided WeakMap.
function hasAt(map, key, value) {
  if (!map.has(key)) return false
  return map.get(key).indexOf(value) !== -1
}

// Helper function to add a value to an array at the provided position
// in the provided WeakMap.
function addAt(map, key, value) {
  var set = (!map.has(key) && map.set(key, []), map.get(key))
  // if (set.indexOf(value) === -1)
    set.push(value)
}

// Helper function to remove a value from the array at the provided position
// in the provided WeakMap.
function removeAt(map, key, value) {
  // if (!map.has(key)) return
  var set = map.get(key)

  var index = set.indexOf(value)
  /*if (index > -1) */ set.splice(index, 1)

  // if the set is empty, remove it from the WeakMap
  if (!set.length) map.delete(key)
}
