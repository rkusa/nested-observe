(function() {
    "use strict";
    var utils$$WeakMVMap = function() {
      this.map = new WeakMap
    }

    utils$$WeakMVMap.prototype.get = function(key) {
      return this.map.get(key)
    }

    utils$$WeakMVMap.prototype.has = function(key, value) {
      if (!this.map.has(key)) return false
      var values = this.map.get(key)
      if (value === undefined && values.length) {
        return true
      }
      return values.indexOf(value) > -1
    }

    utils$$WeakMVMap.prototype.add = function(key, value) {
      if (!this.map.has(key)) {
        this.map.set(key, [])
      }

      var values = this.map.get(key)
      values.push(value)
    }

    utils$$WeakMVMap.prototype.remove = function(key, value) {
      var values = this.map.get(key)

      var index = values.indexOf(value)
      values.splice(index, 1)

      // if the set is empty, remove it from the WeakMap
      if (!values.length) this.map.delete(key)
    }

    var utils$$ParentsMapping = function() {
      this.mapping = new WeakMap
    }

    utils$$ParentsMapping.prototype.add = function(obj, parent, key) {
      if (!parent || key === undefined) return

      if (!this.mapping.has(obj)) {
        this.mapping.set(obj, [])
      }

      var parents = this.mapping.get(obj)
      parents.push({ obj: parent, key: key })
    }

    utils$$ParentsMapping.prototype.remove = function(obj, parent, key) {
      if (!parent || !key === undefined) return

      var parents = this.mapping.get(obj)

      for (var i = 0, len = parents.length; i < len; ++i) {
        if (parents[i].obj === parent && parents[i].key === key) {
          parents.splice(i, 1)
          break
        }
      }

      if (!parents.length) this.mapping.delete(obj)
    }

    utils$$ParentsMapping.prototype.path = function(obj) {
      var path = []
      while (this.mapping.has(obj)) {
        var parent = this.mapping.get(obj)[0]
        var key = parent.key === Array ? parent.obj.indexOf(obj) : parent.key
        path.unshift(key)
        obj = parent.obj
      }
      return path
    }

    // whether to log exceptions thrown during change record delivery
    var index$$debug = false;

    // This weak map is used for `.deliverChangeRecords(callback)` calls, where the
    // provided callback has to mapped to its corresponding delegate.
    // <callback, delegate>
    var index$$delegates = new WeakMap;

    // When using `.observe(obj, callback)`, instead of forwarding the provided
    // `callback` to `Object.observe(obj, callback)` directly, a delegate for the
    // `callback` is created. This delegate transforms changes before forwarding
    // them to the actual `callback`.
    var index$$Delegate = function(callback) {
      this.callback  = callback
      this.observers = new utils$$WeakMVMap

      var self = this
      this.handleChangeRecords = function(records) {
        try {
          var changes = records.map(self.transform, self)
          changes = Array.prototype.concat.apply([], changes) // flatten
          self.callback(changes)
        } catch (err) {
          if (index$$debug) console.error(err.stack)
        }
      }
    }

    // This method transforms the received change record with using the
    // corresponding observer for the object that got changed.
    index$$Delegate.prototype.transform = function(record) {
      if (!this.observers.has(record.object)) {
        return []
      }

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
    var index$$Observer = function(root, delegate, accept) {
      this.root     = root
      this.delegate = delegate
      this.callback = delegate.handleChangeRecords
      this.accept   = accept
      this.parents  = new utils$$ParentsMapping
    }

    // Recursively observe an object and its nested objects.
    index$$Observer.prototype.observe = function(obj, parent, key, visited) {
      if (!obj || typeof obj !== 'object') {
        return
      }

      if (!visited) {
        visited = new WeakMap
      }

      if (visited.has(obj)) {
        return
      }

      visited.set(obj, true)

      // if the object is already observed, i.e., already somewhere else in the
      // nested structure -> do not observe it again
      if (!this.delegate.observers.has(obj, this)) {
        if (Array.isArray(obj) && !this.accept) {
          Object.observe(obj, this.callback, ['add', 'update', 'delete', 'splice'])
        } else {
          Object.observe(obj, this.callback, this.accept)
        }
      }

      // track parent and belonging
      this.parents.add(obj, parent, key)
      this.delegate.observers.add(obj, this)

      // traverse the properties to find nested objects and observe them, too
      var isArray = Array.isArray(obj)
      for (var prop in obj) {
        if (typeof obj[prop] === 'object') {
          this.observe(obj[prop], obj, isArray ? Array : prop, visited)
        }
      }

      if (typeof obj.entries === 'function') {
        var entries = obj.entries()
        if (typeof entries.next === 'function') {
          // for (var pair of entries)
          var pair
          while ((pair = entries.next()).done === false) {
            if (typeof pair.value[1] === 'object') {
              this.observe(pair.value[1], obj, pair.value[0], visited)
            }
          }
        }
      }
    }

    // Recursively unobserve an object and its nested objects.
    index$$Observer.prototype.unobserve = function(obj, parent, key) {
      if (obj === undefined) obj = this.root
      else if (!obj) return

      if (!this.delegate.observers.has(obj, this)) {
        return
      }

      // clean up
      this.parents.remove(obj, parent, key)
      this.delegate.observers.remove(obj, this)

      if (!this.delegate.observers.has(obj)) {
        Object.unobserve(obj, this.callback)
      }

      // traverse the properties to find nested objects and unobserve them, too
      var isArray = Array.isArray(obj)
      for (var prop in obj) {
        if (typeof obj[prop] === 'object') {
          this.unobserve(obj[prop], obj, isArray ? Array : prop)
        }
      }
    }

    // Transform a change record, ie., add the following properties:
    // - **root** - the root of the nested structure
    // - **path** - a [JSON Pointer](http://tools.ietf.org/html/rfc6901)
    //              (absolute from the root) to the changed property
    index$$Observer.prototype.transform = function(change) {
      var self = this

      var record = {
        root: this.root,
        get path() {
          var path = self.parents.path(change.object)
          if (change.name) path.push(change.name)
          return '/' + path.map(function(k) {
            return k.toString().replace(/~/g, '~0').replace(/\//g, '~1')
          }).join('/')
        }
      }

      // the original change record ist not extensible -> copy
      for (var prop in change) {
        record[prop] = change[prop]
      }

      // unobserve deleted/replaced objects
      var deleted = change.oldValue && [change.oldValue] || change.removed || []
      deleted.forEach(function(oldValue, i) {
        if (oldValue === null || typeof oldValue !== 'object') {
          return
        }

        this.unobserve(oldValue, change.object, change.name || change.index + i)
      }, this)

      // observe added/updated objects
      function handleChange(value, parent, key) {
        if (typeof value === 'object') {
          var desc = key !== Array && Object.getOwnPropertyDescriptor(parent, key)
          if (!desc || desc.enumerable === true) {
            self.observe(value, parent, key)
          } else {
            self.unobserve(value, parent, key)
          }
        }
      }

      if (change.name) {
        if (change.name in change.object) {
          handleChange(change.object[change.name], change.object, change.name)
        } else if (typeof change.object.get === 'function') {
          handleChange(change.object.get(change.name), change.object, change.name)
        }
      } else if (change.type === 'splice' && change.addedCount) {
        var added = change.object.slice(change.index, change.index + change.addedCount)
        added.forEach(function(value) {
          handleChange(value, change.object, Array)
        })
      }

      Object.preventExtensions(record)

      return record
    }

    var index$$default = {
      // Corresponds to `Object.observe()` but for nested objects.
      observe: function observe(obj, callback, accept) {
        var delegate

        if (!index$$delegates.has(callback)) {
          delegate = new index$$Delegate(callback)
          index$$delegates.set(callback, delegate)
        } else {
          delegate = index$$delegates.get(callback)
        }

        var observers = delegate.observers
        if (observers.has(obj)) {
          return
        }

        var observer = new index$$Observer(obj, delegate, accept)
        observer.observe(obj)
      },

      // Corresponds to `Object.unobserve()` but for nested objects.
      unobserve: function unobserve(obj, callback) {
        if (!index$$delegates.has(callback)) return
        var delegate = index$$delegates.get(callback)

        if (!delegate.observers.has(obj)) {
          return
        }

        var observers = delegate.observers.get(obj)
        observers.forEach(function(observer) {
          observer.unobserve()
        })
      },

      // Corresponds to `Object.deliverChangeRecords()` but for nested objects.
      deliverChangeRecords: function deliverChangeRecords(callback) {
        if (typeof callback !== 'function') {
          throw new TypeError('Callback must be a function, given: ' + callback)
        }

        if (!index$$delegates.has(callback)) return

        var delegate = index$$delegates.get(callback)
        Object.deliverChangeRecords(delegate.handleChangeRecords)
      },

      get debug() {
        return index$$debug
      },

      set debug(val) {
        index$$debug = val
      }
    };

    window.Nested = index$$default;
}).call(this);
//# sourceMappingURL=nested-observe.js.map