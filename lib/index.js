'use strict'

var pointer = require('json-pointer')

var delegates = new WeakMap // <callback, delegate>

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

Delegate.prototype.transform = function(record) {
  var target = record.object
  var observer = this.observers.get(target)
  return observer.transform(record)
}

var Observer = function(root, delegate, accept) {
  this.root = root
  this.delegate = delegate
  this.callback = delegate.handleChangeRecords
  this.accept = accept
  this.paths = new WeakMap
}

Observer.prototype.observe = function(obj, path) {
  if (!path) path = []

  this.paths.set(obj, path.slice())
  this.delegate.observers.set(obj, this)
  if (Array.isArray(obj) && !this.accept) {
    Object.observe(obj, this.callback, ['add', 'update', 'delete', 'splice'])
  } else {
    Object.observe(obj, this.callback, this.accept)
  }

  for (var key in obj) {
    if (typeof obj[key] === 'object') {
      this.observe(obj[key], path.concat(key))
    }
  }
}

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

Observer.prototype.transform = function(change) {
  var key = change.name || change.index

  var path = this.paths.get(change.object).concat(key.toString())
  var record = {
    root: this.root,
    path: pointer.compile(path)
  }

  for (var prop in change) {
    record[prop] = change[prop]
  }

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

exports.deliverChangeRecords = function(callback) {
  if (!delegates.has(callback)) return

  var delegate = delegates.get(callback)
  Object.deliverChangeRecords(delegate.handleChangeRecords)
}

function comparePaths(lhs, rhs) {
  if (lhs.length !== rhs.length) return false
  for (var i = 0, len = lhs.length; i < len; ++i) {
    if (lhs[i] !== rhs[i]) return false
  }
  return true
}
