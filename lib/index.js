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
    self.callback(records.map(self.transform, self).filter(function(record) {
      return record !== null
    }))
  }
}

// This method transforms the received change record with using the
// corresponding observer for the object that got changed.
Delegate.prototype.transform = function(record) {
  var target   = record.object
  var observer = this.observers.get(target)
  return observer.transform(record)
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
Observer.prototype.observe = function(obj, path) {
  if (!path) path = []

  // track the path and belonging
  // TODO: this does not yet support the following two edge cases
  // 1. an object exists multiple times in the nested data structure
  // 2. and object exists in two different nested data structures that are
  //    both observed using the same callback
  this.paths.set(obj, path.slice())
  this.delegate.observers.set(obj, this)

  if (Array.isArray(obj) && !this.accept) {
    Object.observe(obj, this.callback, ['add', 'update', 'delete', 'splice'])
  } else {
    Object.observe(obj, this.callback, this.accept)
  }

  // traverse the properties to find nested objects
  for (var key in obj) {
    if (typeof obj[key] === 'object') {
      this.observe(obj[key], path.concat(key))
    }
  }
}

// Recursively unobserve an object and its nested objects.
Observer.prototype.unobserve = function(obj) {
  if (!obj) obj = this.root

  this.paths.delete(obj)
  this.delegate.observers.delete(obj)

  Object.unobserve(obj, this.callback)

  for (var key in obj) {
    if (typeof obj[key] === 'object') {
      this.unobserve(obj[key])
    }
  }
}

// Transform a change record, ie., add the following properties:
// - **root** - the root of the nested structure
// - **path** - a [JSON Pointer](http://tools.ietf.org/html/rfc6901)
//              (absolute from the root) to the changed property
Observer.prototype.transform = function(change) {
  var key = String(change.name || change.index)

  var path = this.paths.get(change.object).concat(key)
  var record = {
    root: this.root,
    path: pointer.compile(path)
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

    if (!comparePaths(this.paths.get(oldValue), path)) {
      return
    }

    this.unobserve(oldValue)
  }, this)

  // observe added/updated objects
  var value = change.object[key]
  if (typeof value === 'object') {
    var desc = Object.getOwnPropertyDescriptor(change.object, key)
    if (desc.enumerable === true) {
      this.observe(value, path)
    } else {
      this.unobserve(value)
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

  var observers = delegate.observers
  if (!observers.has(obj)) {
    return
  }

  var observer = observers.get(obj)
  observer.unobserve()
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

// Helper function to compare two paths (pointers represented as arrays).
function comparePaths(lhs, rhs) {
  if (lhs.length !== rhs.length) return false
  for (var i = 0, len = lhs.length; i < len; ++i) {
    if (lhs[i] !== rhs[i]) return false
  }
  return true
}
