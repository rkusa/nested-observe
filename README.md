# nested-observe

`Object.observe()` for nested objects.

[![NPM][npm]](https://npmjs.org/package/nested-observe)
[![Dependency Status][dependencies]](https://david-dm.org/rkusa/nested-observe)
[![Coverage][coveralls]](https://coveralls.io/r/rkusa/nested-observe)
[![Build Status][travis]](http://travis-ci.org/rkusa/nested-observe)

## Compatability

`nested-observe` internally uses `WeakMap` (for garbage collection). Node.js supports both `WeakMap` and `Object.observe` since version `0.11.13`. For browsers have a look at: [kangax's compaitibility table](http://kangax.github.io/compat-table/es7/#Object.observe). For unsupported browsers/Node.js, you can use shims, e.g. [KapIT/observe-shim](https://github.com/KapIT/observe-shim) and [Benvie/WeakMap](https://github.com/Benvie/WeakMap).

## Api

```js
var Nested = require('nested-observe')
Nested.observe(root, callback, accept)
Nested.unobserve(root, callback)
Nested.deliverChangeRecords(callback)
```

Delivered change records contain two additional properties:

- **root** - the root of the nested structure
- **path** - a [JSON Pointer](http://tools.ietf.org/html/rfc6901) (absolute from the root) to the changed property

## MIT License

Copyright (c) 2014 Markus Ast

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[npm]: http://img.shields.io/npm/v/nested-observe.svg?style=flat
[dependencies]: http://img.shields.io/david/rkusa/nested-observe.svg?style=flat
[coveralls]: http://img.shields.io/coveralls/rkusa/nested-observe.svg?style=flat
[travis]: http://img.shields.io/travis/rkusa/nested-observe.svg?style=flat
