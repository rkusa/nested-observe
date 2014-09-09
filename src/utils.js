// WeakMultiValueMap

export var WeakMVMap = function() {
  this.map = new WeakMap
}

WeakMVMap.prototype.get = function(key) {
  return this.map.get(key)
}

WeakMVMap.prototype.has = function(key, value) {
  if (!this.map.has(key)) return false
  var values = this.map.get(key)
  if (value === undefined && values.length) {
    return true
  }
  return values.indexOf(value) > -1
}

WeakMVMap.prototype.add = function(key, value) {
  if (!this.map.has(key)) {
    this.map.set(key, [])
  }

  var values = this.map.get(key)
  values.push(value)
}

WeakMVMap.prototype.remove = function(key, value) {
  var values = this.map.get(key)

  var index = values.indexOf(value)
  values.splice(index, 1)

  // if the set is empty, remove it from the WeakMap
  if (!values.length) this.map.delete(key)
}

// ParentsMapping

export var ParentsMapping = function() {
  this.mapping = new WeakMap
}

ParentsMapping.prototype.add = function(obj, parent, key) {
  if (!parent || key === undefined) return

  if (!this.mapping.has(obj)) {
    this.mapping.set(obj, [])
  }

  var parents = this.mapping.get(obj)
  parents.push({ obj: parent, key: key })
}

ParentsMapping.prototype.remove = function(obj, parent, key) {
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

ParentsMapping.prototype.path = function(obj) {
  var path = []
  while (this.mapping.has(obj)) {
    var parent = this.mapping.get(obj)[0]
    var key = parent.key === Array ? parent.obj.indexOf(obj) : parent.key
    path.unshift(key)
    obj = parent.obj
  }
  return path
}
