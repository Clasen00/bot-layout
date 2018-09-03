/*!
* rete v1.0.0-alpha.2
* (c) 2018 Vitaliy Stoliarov
* Released under the MIT License.
*/
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

!(function(global) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] =
    GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  runtime.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return Promise.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return Promise.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration. If the Promise is rejected, however, the
          // result for this iteration will be rejected with the same
          // reason. Note that rejections of yielded Promises are not
          // thrown back into the generator function, as is the case
          // when an awaited Promise is rejected. This difference in
          // behavior between yield and await is important, because it
          // allows the consumer to decide what to do with the yielded
          // rejection (swallow it and continue, manually .throw it back
          // into the generator, abandon iteration, whatever). With
          // await, by contrast, there is no opportunity to examine the
          // rejection reason outside the generator function, so the
          // only option is to throw it from the await expression, and
          // let the generator function handle the exception.
          result.value = unwrapped;
          resolve(result);
        }, reject);
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new Promise(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  runtime.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        if (delegate.iterator.return) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[toStringTagSymbol] = "Generator";

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };
})(
  // In sloppy mode, unbound `this` refers to the global object, fallback to
  // Function constructor if we're in global strict mode. That is sadly a form
  // of indirect eval which violates Content Security Policy.
  (function() { return this })() || Function("return this")()
);

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Rete = factory());
}(this, (function () { 'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

var Component = function () {
    function Component(name) {
        classCallCheck(this, Component);

        if (this.constructor === Component) throw new TypeError('Can not construct abstract class.');

        this.name = name;
        this.data = {};
        this.engine = null;
    }

    createClass(Component, [{
        key: 'worker',
        value: function worker() {}
    }]);
    return Component;
}();

var Control = function () {
    function Control() {
        classCallCheck(this, Control);

        if (this.constructor === Control) throw new TypeError('Can not construct abstract class.');

        this.data = {};
        this.parent = null;
    }

    createClass(Control, [{
        key: 'getNode',
        value: function getNode() {
            if (this.parent === null) throw new Error("Control isn't added to Node/Input");

            return this.parent instanceof Node ? this.parent : this.parent.node;
        }
    }, {
        key: 'getData',
        value: function getData(key) {
            return this.getNode().data[key];
        }
    }, {
        key: 'putData',
        value: function putData(key, data) {
            this.getNode().data[key] = data;
        }
    }]);
    return Control;
}();

var Connection = function () {
    function Connection(output, input) {
        classCallCheck(this, Connection);

        this.output = output;
        this.input = input;
        this.data = {};

        this.input.addConnection(this);
    }

    createClass(Connection, [{
        key: "remove",
        value: function remove() {
            this.input.removeConnection(this);
            this.output.removeConnection(this);
        }
    }]);
    return Connection;
}();

var IO = function () {
    function IO(name, socket, multiConns) {
        classCallCheck(this, IO);

        this.node = null;
        this.multipleConnections = multiConns;
        this.connections = [];

        this.name = name;
        this.socket = socket;
    }

    createClass(IO, [{
        key: 'removeConnection',
        value: function removeConnection(connection) {
            if (!(connection instanceof Connection)) {
                throw new TypeError('Value of argument "connection" violates contract.\n\nExpected:\nConnection\n\nGot:\n' + _inspect(connection));
            }

            this.connections.splice(this.connections.indexOf(connection), 1);
        }
    }]);
    return IO;
}();

function _inspect(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect(input[0], depth);

            if (input.every(function (item) {
                return _inspect(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Socket = function () {
    function Socket(name) {
        var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        classCallCheck(this, Socket);

        if (!(typeof name === 'string')) {
            throw new TypeError("Value of argument \"name\" violates contract.\n\nExpected:\nstring\n\nGot:\n" + _inspect$1(name));
        }

        this.name = name;
        this.data = data;
        this.compatible = [];
    }

    createClass(Socket, [{
        key: "combineWith",
        value: function combineWith(socket) {
            if (!(socket instanceof Socket)) {
                throw new TypeError("Value of argument \"socket\" violates contract.\n\nExpected:\nSocket\n\nGot:\n" + _inspect$1(socket));
            }

            this.compatible.push(socket);
        }
    }, {
        key: "compatibleWith",
        value: function compatibleWith(socket) {
            if (!(socket instanceof Socket)) {
                throw new TypeError("Value of argument \"socket\" violates contract.\n\nExpected:\nSocket\n\nGot:\n" + _inspect$1(socket));
            }

            return this === socket || this.compatible.includes(socket);
        }
    }]);
    return Socket;
}();

function _inspect$1(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === "undefined" ? "undefined" : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$1(input[0], depth);

            if (input.every(function (item) {
                return _inspect$1(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$1(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$1(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Input = function (_IO) {
    inherits(Input, _IO);

    function Input(title, socket) {
        var multiConns = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        classCallCheck(this, Input);

        if (!(typeof title === 'string')) {
            throw new TypeError('Value of argument "title" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$2(title));
        }

        if (!(socket instanceof Socket)) {
            throw new TypeError('Value of argument "socket" violates contract.\n\nExpected:\nSocket\n\nGot:\n' + _inspect$2(socket));
        }

        if (!(typeof multiConns === 'boolean')) {
            throw new TypeError('Value of argument "multiConns" violates contract.\n\nExpected:\nboolean\n\nGot:\n' + _inspect$2(multiConns));
        }

        var _this = possibleConstructorReturn(this, (Input.__proto__ || Object.getPrototypeOf(Input)).call(this, title, socket, multiConns));

        _this.control = null;
        return _this;
    }

    createClass(Input, [{
        key: 'hasConnection',
        value: function hasConnection() {
            return this.connections.length > 0;
        }
    }, {
        key: 'addConnection',
        value: function addConnection(connection) {
            if (!(connection instanceof Connection)) {
                throw new TypeError('Value of argument "connection" violates contract.\n\nExpected:\nConnection\n\nGot:\n' + _inspect$2(connection));
            }

            if (!this.multipleConnections && this.hasConnection()) throw new Error('Multiple connections not allowed');
            this.connections.push(connection);
        }
    }, {
        key: 'addControl',
        value: function addControl(control) {
            if (!(control instanceof Control)) {
                throw new TypeError('Value of argument "control" violates contract.\n\nExpected:\nControl\n\nGot:\n' + _inspect$2(control));
            }

            this.control = control;
            control.parent = this;
        }
    }, {
        key: 'showControl',
        value: function showControl() {
            return !this.hasConnection() && this.control !== null;
        }
    }, {
        key: 'toJSON',
        value: function toJSON() {
            return {
                'connections': this.connections.map(function (c) {
                    return {
                        node: c.output.node.id,
                        output: c.output.node.outputs.indexOf(c.output),
                        data: c.data
                    };
                })
            };
        }
    }]);
    return Input;
}(IO);

function _inspect$2(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$2(input[0], depth);

            if (input.every(function (item) {
                return _inspect$2(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$2(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$2(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Output = function (_IO) {
    inherits(Output, _IO);

    function Output(title, socket) {
        var multiConns = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
        classCallCheck(this, Output);

        if (!(typeof title === 'string')) {
            throw new TypeError('Value of argument "title" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$3(title));
        }

        if (!(socket instanceof Socket)) {
            throw new TypeError('Value of argument "socket" violates contract.\n\nExpected:\nSocket\n\nGot:\n' + _inspect$3(socket));
        }

        if (!(typeof multiConns === 'boolean')) {
            throw new TypeError('Value of argument "multiConns" violates contract.\n\nExpected:\nboolean\n\nGot:\n' + _inspect$3(multiConns));
        }

        return possibleConstructorReturn(this, (Output.__proto__ || Object.getPrototypeOf(Output)).call(this, title, socket, multiConns));
    }

    createClass(Output, [{
        key: 'hasConnection',
        value: function hasConnection() {
            return this.connections.length > 0;
        }
    }, {
        key: 'connectTo',
        value: function connectTo(input) {
            if (!(input instanceof Input)) {
                throw new TypeError('Value of argument "input" violates contract.\n\nExpected:\nInput\n\nGot:\n' + _inspect$3(input));
            }

            if (!this.socket.compatibleWith(input.socket)) throw new Error('Sockets not compatible');
            if (!input.multipleConnections && input.hasConnection()) throw new Error('Input already has one connection');
            if (!this.multipleConnections && this.hasConnection()) throw new Error('Output already has one connection');

            var connection = new Connection(this, input);

            this.connections.push(connection);
            return connection;
        }
    }, {
        key: 'connectedTo',
        value: function connectedTo(input) {
            if (!(input instanceof Input)) {
                throw new TypeError('Value of argument "input" violates contract.\n\nExpected:\nInput\n\nGot:\n' + _inspect$3(input));
            }

            return this.connections.some(function (item) {
                return item.input === input;
            });
        }
    }, {
        key: 'toJSON',
        value: function toJSON() {
            return {
                'connections': this.connections.map(function (c) {
                    return {
                        node: c.input.node.id,
                        input: c.input.node.inputs.indexOf(c.input),
                        data: c.data
                    };
                })
            };
        }
    }]);
    return Output;
}(IO);

function _inspect$3(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$3(input[0], depth);

            if (input.every(function (item) {
                return _inspect$3(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$3(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$3(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Node = function () {
    function Node(name) {
        classCallCheck(this, Node);

        if (!(typeof name === 'string')) {
            throw new TypeError('Value of argument "name" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$4(name));
        }

        this.name = name;
        this.id = Node.incrementId();
        this.position = [0.0, 0.0];

        this.inputs = [];
        this.outputs = [];
        this.controls = [];
        this.data = {};
        this.meta = {};
    }

    createClass(Node, [{
        key: 'addControl',
        value: function addControl(control) {
            var index = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.controls.length;

            if (!(control instanceof Control)) {
                throw new TypeError('Value of argument "control" violates contract.\n\nExpected:\nControl\n\nGot:\n' + _inspect$4(control));
            }

            if (!(index == null || typeof index === 'number' && !isNaN(index) && index >= 0 && index <= 255 && index === Math.floor(index))) {
                throw new TypeError('Value of argument "index" violates contract.\n\nExpected:\n?uint8\n\nGot:\n' + _inspect$4(index));
            }

            control.parent = this;

            this.controls.splice(index, 0, control);
            return this;
        }
    }, {
        key: 'addInput',
        value: function addInput(input) {
            var index = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.inputs.length;

            if (!(input instanceof Input)) {
                throw new TypeError('Value of argument "input" violates contract.\n\nExpected:\nInput\n\nGot:\n' + _inspect$4(input));
            }

            if (!(index == null || typeof index === 'number' && !isNaN(index) && index >= 0 && index <= 255 && index === Math.floor(index))) {
                throw new TypeError('Value of argument "index" violates contract.\n\nExpected:\n?uint8\n\nGot:\n' + _inspect$4(index));
            }

            if (input.node !== null) throw new Error('Input has already been added to the node');

            input.node = this;

            this.inputs.splice(index, 0, input);
            return this;
        }
    }, {
        key: 'addOutput',
        value: function addOutput(output) {
            var index = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.outputs.length;

            if (!(output instanceof Output)) {
                throw new TypeError('Value of argument "output" violates contract.\n\nExpected:\nOutput\n\nGot:\n' + _inspect$4(output));
            }

            if (!(index == null || typeof index === 'number' && !isNaN(index) && index >= 0 && index <= 255 && index === Math.floor(index))) {
                throw new TypeError('Value of argument "index" violates contract.\n\nExpected:\n?uint8\n\nGot:\n' + _inspect$4(index));
            }

            if (output.node !== null) throw new Error('Output has already been added to the node');

            output.node = this;

            this.outputs.splice(index, 0, output);
            return this;
        }
    }, {
        key: 'getConnections',
        value: function getConnections() {
            var ios = [].concat(toConsumableArray(this.inputs), toConsumableArray(this.outputs));
            var connections = ios.reduce(function (arr, io) {
                return [].concat(toConsumableArray(arr), toConsumableArray(io.connections));
            }, []);

            return connections;
        }
    }, {
        key: 'inputsWithVisibleControl',
        value: function inputsWithVisibleControl() {
            return this.inputs.filter(function (input) {
                return input.showControl();
            });
        }
    }, {
        key: 'toJSON',
        value: function toJSON() {
            return {
                'id': this.id,
                'data': this.data,
                'inputs': this.inputs.map(function (input) {
                    return input.toJSON();
                }),
                'outputs': this.outputs.map(function (output) {
                    return output.toJSON();
                }),
                'position': this.position,
                'name': this.name
            };
        }
    }], [{
        key: 'incrementId',
        value: function incrementId() {
            if (!this.latestId) this.latestId = 1;else this.latestId++;
            return this.latestId;
        }
    }, {
        key: 'fromJSON',
        value: function fromJSON(json) {
            if (!(json instanceof Object)) {
                throw new TypeError('Value of argument "json" violates contract.\n\nExpected:\nObject\n\nGot:\n' + _inspect$4(json));
            }

            var node = new Node(json.name);

            node.id = json.id;
            node.data = json.data;
            node.position = json.position;
            node.name = json.name;
            Node.latestId = Math.max(node.id, Node.latestId);

            return node;
        }
    }]);
    return Node;
}();

function _inspect$4(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$4(input[0], depth);

            if (input.every(function (item) {
                return _inspect$4(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$4(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$4(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Component$1 = function (_ComponentWorker) {
    inherits(Component$$1, _ComponentWorker);

    function Component$$1(name) {
        classCallCheck(this, Component$$1);

        var _this = possibleConstructorReturn(this, (Component$$1.__proto__ || Object.getPrototypeOf(Component$$1)).call(this, name));

        if (_this.constructor === Component$$1) throw new TypeError('Can not construct abstract class.');

        _this.editor = null;
        _this.data = {};
        return _this;
    }

    createClass(Component$$1, [{
        key: 'builder',
        value: function builder() {
            return regeneratorRuntime.async(function builder$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'created',
        value: function created() {}
    }, {
        key: 'destroyed',
        value: function destroyed() {}
    }, {
        key: 'build',
        value: function build(node) {
            return regeneratorRuntime.async(function build$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            if (node instanceof Node) {
                                _context2.next = 2;
                                break;
                            }

                            throw new TypeError('Value of argument "node" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$5(node));

                        case 2:
                            _context2.next = 4;
                            return regeneratorRuntime.awrap(this.builder(node));

                        case 4:
                            return _context2.abrupt('return', node);

                        case 5:
                        case 'end':
                            return _context2.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'createNode',
        value: function createNode() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            var node;
            return regeneratorRuntime.async(function createNode$(_context3) {
                while (1) {
                    switch (_context3.prev = _context3.next) {
                        case 0:
                            node = new Node(this.name);


                            node.data = data;
                            _context3.next = 4;
                            return regeneratorRuntime.awrap(this.build(node));

                        case 4:
                            return _context3.abrupt('return', node);

                        case 5:
                        case 'end':
                            return _context3.stop();
                    }
                }
            }, null, this);
        }
    }]);
    return Component$$1;
}(Component);

function _inspect$5(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$5(input[0], depth);

            if (input.every(function (item) {
                return _inspect$5(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$5(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$5(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Events = function Events(handlers) {
    classCallCheck(this, Events);

    this.handlers = _extends({
        warn: [console.warn],
        error: [console.error]
    }, handlers);
};

var Emitter = function () {
    function Emitter(events) {
        classCallCheck(this, Emitter);

        if (!(events instanceof Events || events instanceof Emitter)) {
            throw new TypeError('Value of argument "events" violates contract.\n\nExpected:\nEvents | Emitter\n\nGot:\n' + _inspect$6(events));
        }

        this.events = events instanceof Emitter ? events.events : events.handlers;
        this.silent = false;
    }

    createClass(Emitter, [{
        key: 'on',
        value: function on(names, handler) {
            var _this = this;

            if (!(typeof names === 'string')) {
                throw new TypeError('Value of argument "names" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$6(names));
            }

            if (!(typeof handler === 'function')) {
                throw new TypeError('Value of argument "handler" violates contract.\n\nExpected:\n() => {}\n\nGot:\n' + _inspect$6(handler));
            }

            names.split(' ').forEach(function (name) {
                if (!_this.events[name]) throw new Error('The event ' + name + ' does not exist');
                _this.events[name].push(handler);
            });

            return this;
        }
    }, {
        key: 'trigger',
        value: function trigger(name, params) {
            if (!(typeof name === 'string')) {
                throw new TypeError('Value of argument "name" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$6(name));
            }

            if (!(name in this.events)) throw new Error('The event ' + name + ' cannot be triggered');

            return this.events[name].reduce(function (r, e) {
                return e(params) !== false && r;
            }, true); // return false if at least one event is false        
        }
    }]);
    return Emitter;
}();

function _inspect$6(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$6(input[0], depth);

            if (input.every(function (item) {
                return _inspect$6(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$6(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$6(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Validator = function () {
    function Validator() {
        classCallCheck(this, Validator);
    }

    createClass(Validator, null, [{
        key: 'isValidData',
        value: function isValidData(data) {
            return typeof data.id === 'string' && this.isValidId(data.id) && data.nodes instanceof Object && !(data.nodes instanceof Array);
        }
    }, {
        key: 'isValidId',
        value: function isValidId(id) {
            return (/^[\w-]{3,}@[0-9]+\.[0-9]+\.[0-9]+$/.test(id)
            );
        }
    }, {
        key: 'validate',
        value: function validate(id, data) {
            var msg = '';
            var id1 = id.split('@');
            var id2 = data.id.split('@');

            if (!this.isValidData(data)) msg += 'Data is not suitable. ';
            if (id !== data.id) msg += 'IDs not equal. ';
            if (id1[0] !== id2[0]) msg += 'Names don\'t match. ';
            if (id1[1] !== id2[1]) msg += 'Versions don\'t match';

            return { success: msg === '', msg: msg };
        }
    }]);
    return Validator;
}();

var Context = function (_Emitter) {
    inherits(Context, _Emitter);

    function Context(id, events) {
        classCallCheck(this, Context);

        var _this = possibleConstructorReturn(this, (Context.__proto__ || Object.getPrototypeOf(Context)).call(this, events));

        if (!Validator.isValidId(id)) throw new Error('ID should be valid to name@0.1.0 format');

        _this.id = id;
        return _this;
    }

    createClass(Context, [{
        key: 'use',
        value: function use(plugin) {
            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            plugin.install(this, options);
        }
    }]);
    return Context;
}(Emitter);

var EngineEvents = function (_Events) {
    inherits(EngineEvents, _Events);

    function EngineEvents() {
        classCallCheck(this, EngineEvents);
        return possibleConstructorReturn(this, (EngineEvents.__proto__ || Object.getPrototypeOf(EngineEvents)).call(this, {
            componentregister: []
        }));
    }

    return EngineEvents;
}(Events);

var State = { AVALIABLE: 0, PROCESSED: 1, ABORT: 2 };

var Engine = function (_Context) {
    inherits(Engine, _Context);

    function Engine(id) {
        classCallCheck(this, Engine);

        if (!(typeof id === 'string')) {
            throw new TypeError('Value of argument "id" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$7(id));
        }

        var _this = possibleConstructorReturn(this, (Engine.__proto__ || Object.getPrototypeOf(Engine)).call(this, id, new EngineEvents()));

        _this.components = [];
        _this.args = [];
        _this.data = null;
        _this.state = State.AVALIABLE;
        _this.onAbort = function () {};
        return _this;
    }

    createClass(Engine, [{
        key: 'clone',
        value: function clone() {
            var engine = new Engine(this.id);

            this.components.map(function (c) {
                return engine.register(c);
            });

            return engine;
        }
    }, {
        key: 'register',
        value: function register(component) {
            if (!(component instanceof Component)) {
                throw new TypeError('Value of argument "component" violates contract.\n\nExpected:\nComponent\n\nGot:\n' + _inspect$7(component));
            }

            this.components.push(component);
            this.trigger('componentregister', component);
        }
    }, {
        key: 'throwError',
        value: function throwError(message) {
            var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
            return regeneratorRuntime.async(function throwError$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            _context.next = 2;
                            return regeneratorRuntime.awrap(this.abort());

                        case 2:
                            this.trigger('error', { message: message, data: data });
                            this.processDone();

                            return _context.abrupt('return', 'error');

                        case 5:
                        case 'end':
                            return _context.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'extractInputNodes',
        value: function extractInputNodes(node, nodes) {
            return node.inputs.reduce(function (a, inp) {
                return [].concat(toConsumableArray(a), toConsumableArray((inp.connections || []).reduce(function (b, c) {
                    return [].concat(toConsumableArray(b), [nodes[c.node]]);
                }, [])));
            }, []);
        }
    }, {
        key: 'detectRecursions',
        value: function detectRecursions(nodes) {
            var _this2 = this;

            var nodesArr = Object.keys(nodes).map(function (id) {
                return nodes[id];
            });
            var findSelf = function findSelf(node, inputNodes) {
                if (inputNodes.some(function (n) {
                    return n === node;
                })) return node;

                for (var i = 0; i < inputNodes.length; i++) {
                    if (findSelf(node, _this2.extractInputNodes(inputNodes[i], nodes))) return node;
                }

                return null;
            };

            return nodesArr.map(function (node) {
                return findSelf(node, _this2.extractInputNodes(node, nodes));
            }).filter(function (r) {
                return r !== null;
            });
        }
    }, {
        key: 'processStart',
        value: function processStart() {
            if (this.state === State.AVALIABLE) {
                this.state = State.PROCESSED;
                return true;
            }

            if (this.state === State.ABORT) {
                return false;
            }

            console.warn('The process is busy and has not been restarted.\n                Use abort() to force it to complete');
            return false;
        }
    }, {
        key: 'processDone',
        value: function processDone() {
            var success = this.state !== State.ABORT;

            this.state = State.AVALIABLE;

            if (!success) {
                this.onAbort();
                this.onAbort = function () {};
            }

            return success;
        }
    }, {
        key: 'abort',
        value: function abort() {
            var _this3 = this;

            return regeneratorRuntime.async(function abort$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            return _context2.abrupt('return', new Promise(function (ret) {
                                if (_this3.state === State.PROCESSED) {
                                    _this3.state = State.ABORT;
                                    _this3.onAbort = ret;
                                } else if (_this3.state === State.ABORT) {
                                    _this3.onAbort();
                                    _this3.onAbort = ret;
                                } else ret();
                            }));

                        case 1:
                        case 'end':
                            return _context2.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'lock',
        value: function lock(node) {
            return regeneratorRuntime.async(function lock$(_context3) {
                while (1) {
                    switch (_context3.prev = _context3.next) {
                        case 0:
                            return _context3.abrupt('return', new Promise(function (res) {
                                node.unlockPool = node.unlockPool || [];
                                if (node.busy && !node.outputData) node.unlockPool.push(res);else res();

                                node.busy = true;
                            }));

                        case 1:
                        case 'end':
                            return _context3.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'unlock',
        value: function unlock(node) {
            node.unlockPool.forEach(function (a) {
                return a();
            });
            node.unlockPool = [];
            node.busy = false;
        }
    }, {
        key: 'extractInputData',
        value: function extractInputData(node) {
            var _this4 = this;

            return regeneratorRuntime.async(function extractInputData$(_context6) {
                while (1) {
                    switch (_context6.prev = _context6.next) {
                        case 0:
                            _context6.next = 2;
                            return regeneratorRuntime.awrap(Promise.all(node.inputs.map(function _callee2(input) {
                                var conns, connData;
                                return regeneratorRuntime.async(function _callee2$(_context5) {
                                    while (1) {
                                        switch (_context5.prev = _context5.next) {
                                            case 0:
                                                conns = input.connections;
                                                _context5.next = 3;
                                                return regeneratorRuntime.awrap(Promise.all(conns.map(function _callee(c) {
                                                    var prevNode, outputs;
                                                    return regeneratorRuntime.async(function _callee$(_context4) {
                                                        while (1) {
                                                            switch (_context4.prev = _context4.next) {
                                                                case 0:
                                                                    prevNode = _this4.data.nodes[c.node];
                                                                    _context4.next = 3;
                                                                    return regeneratorRuntime.awrap(_this4.processNode(prevNode));

                                                                case 3:
                                                                    outputs = _context4.sent;

                                                                    if (outputs) {
                                                                        _context4.next = 8;
                                                                        break;
                                                                    }

                                                                    _this4.abort();
                                                                    _context4.next = 9;
                                                                    break;

                                                                case 8:
                                                                    return _context4.abrupt('return', outputs[c.output]);

                                                                case 9:
                                                                case 'end':
                                                                    return _context4.stop();
                                                            }
                                                        }
                                                    }, null, _this4);
                                                })));

                                            case 3:
                                                connData = _context5.sent;
                                                return _context5.abrupt('return', connData);

                                            case 5:
                                            case 'end':
                                                return _context5.stop();
                                        }
                                    }
                                }, null, _this4);
                            })));

                        case 2:
                            return _context6.abrupt('return', _context6.sent);

                        case 3:
                        case 'end':
                            return _context6.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'processWorker',
        value: function processWorker(node) {
            var inputData, component, outputData;
            return regeneratorRuntime.async(function processWorker$(_context7) {
                while (1) {
                    switch (_context7.prev = _context7.next) {
                        case 0:
                            _context7.next = 2;
                            return regeneratorRuntime.awrap(this.extractInputData(node));

                        case 2:
                            inputData = _context7.sent;
                            component = this.components.find(function (c) {
                                return c.name === node.name;
                            });
                            outputData = node.outputs.map(function () {
                                return null;
                            });
                            _context7.prev = 5;
                            _context7.next = 8;
                            return regeneratorRuntime.awrap(component.worker.apply(component, [node, inputData, outputData].concat(toConsumableArray(this.args))));

                        case 8:
                            _context7.next = 14;
                            break;

                        case 10:
                            _context7.prev = 10;
                            _context7.t0 = _context7['catch'](5);

                            this.abort();
                            this.trigger('warn', _context7.t0);

                        case 14:
                            return _context7.abrupt('return', outputData);

                        case 15:
                        case 'end':
                            return _context7.stop();
                    }
                }
            }, null, this, [[5, 10]]);
        }
    }, {
        key: 'processNode',
        value: function processNode(node) {
            return regeneratorRuntime.async(function processNode$(_context8) {
                while (1) {
                    switch (_context8.prev = _context8.next) {
                        case 0:
                            if (!(this.state === State.ABORT || !node)) {
                                _context8.next = 2;
                                break;
                            }

                            return _context8.abrupt('return', null);

                        case 2:
                            _context8.next = 4;
                            return regeneratorRuntime.awrap(this.lock(node));

                        case 4:

                            if (!node.outputData) {
                                node.outputData = this.processWorker(node);
                            }

                            this.unlock(node);
                            return _context8.abrupt('return', node.outputData);

                        case 7:
                        case 'end':
                            return _context8.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'forwardProcess',
        value: function forwardProcess(node) {
            var _this5 = this;

            return regeneratorRuntime.async(function forwardProcess$(_context11) {
                while (1) {
                    switch (_context11.prev = _context11.next) {
                        case 0:
                            if (!(this.state === State.ABORT)) {
                                _context11.next = 2;
                                break;
                            }

                            return _context11.abrupt('return', null);

                        case 2:
                            _context11.next = 4;
                            return regeneratorRuntime.awrap(Promise.all(node.outputs.map(function _callee4(output) {
                                return regeneratorRuntime.async(function _callee4$(_context10) {
                                    while (1) {
                                        switch (_context10.prev = _context10.next) {
                                            case 0:
                                                _context10.next = 2;
                                                return regeneratorRuntime.awrap(Promise.all(output.connections.map(function _callee3(c) {
                                                    var nextNode;
                                                    return regeneratorRuntime.async(function _callee3$(_context9) {
                                                        while (1) {
                                                            switch (_context9.prev = _context9.next) {
                                                                case 0:
                                                                    nextNode = _this5.data.nodes[c.node];
                                                                    _context9.next = 3;
                                                                    return regeneratorRuntime.awrap(_this5.processNode(nextNode));

                                                                case 3:
                                                                    _context9.next = 5;
                                                                    return regeneratorRuntime.awrap(_this5.forwardProcess(nextNode));

                                                                case 5:
                                                                case 'end':
                                                                    return _context9.stop();
                                                            }
                                                        }
                                                    }, null, _this5);
                                                })));

                                            case 2:
                                                return _context10.abrupt('return', _context10.sent);

                                            case 3:
                                            case 'end':
                                                return _context10.stop();
                                        }
                                    }
                                }, null, _this5);
                            })));

                        case 4:
                            return _context11.abrupt('return', _context11.sent);

                        case 5:
                        case 'end':
                            return _context11.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'copy',
        value: function copy(data) {
            data = Object.assign({}, data);
            data.nodes = Object.assign({}, data.nodes);

            Object.keys(data.nodes).forEach(function (key) {
                data.nodes[key] = Object.assign({}, data.nodes[key]);
            });
            return data;
        }
    }, {
        key: 'validate',
        value: function validate(data) {
            var checking, recurentNodes;
            return regeneratorRuntime.async(function validate$(_context12) {
                while (1) {
                    switch (_context12.prev = _context12.next) {
                        case 0:
                            checking = Validator.validate(this.id, data);

                            if (checking.success) {
                                _context12.next = 5;
                                break;
                            }

                            _context12.next = 4;
                            return regeneratorRuntime.awrap(this.throwError(checking.msg));

                        case 4:
                            return _context12.abrupt('return', _context12.sent);

                        case 5:
                            recurentNodes = this.detectRecursions(data.nodes);

                            if (!(recurentNodes.length > 0)) {
                                _context12.next = 10;
                                break;
                            }

                            _context12.next = 9;
                            return regeneratorRuntime.awrap(this.throwError('Recursion detected', recurentNodes));

                        case 9:
                            return _context12.abrupt('return', _context12.sent);

                        case 10:
                            return _context12.abrupt('return', true);

                        case 11:
                        case 'end':
                            return _context12.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'processStartNode',
        value: function processStartNode(id) {
            var startNode;
            return regeneratorRuntime.async(function processStartNode$(_context13) {
                while (1) {
                    switch (_context13.prev = _context13.next) {
                        case 0:
                            if (!id) {
                                _context13.next = 10;
                                break;
                            }

                            startNode = this.data.nodes[id];

                            if (startNode) {
                                _context13.next = 6;
                                break;
                            }

                            _context13.next = 5;
                            return regeneratorRuntime.awrap(this.throwError('Node with such id not found'));

                        case 5:
                            return _context13.abrupt('return', _context13.sent);

                        case 6:
                            _context13.next = 8;
                            return regeneratorRuntime.awrap(this.processNode(startNode));

                        case 8:
                            _context13.next = 10;
                            return regeneratorRuntime.awrap(this.forwardProcess(startNode));

                        case 10:
                        case 'end':
                            return _context13.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'processUnreachable',
        value: function processUnreachable() {
            var i, node;
            return regeneratorRuntime.async(function processUnreachable$(_context14) {
                while (1) {
                    switch (_context14.prev = _context14.next) {
                        case 0:
                            _context14.t0 = regeneratorRuntime.keys(this.data.nodes);

                        case 1:
                            if ((_context14.t1 = _context14.t0()).done) {
                                _context14.next = 11;
                                break;
                            }

                            i = _context14.t1.value;

                            if (!(typeof this.data.nodes[i].outputData === 'undefined')) {
                                _context14.next = 9;
                                break;
                            }

                            node = this.data.nodes[i];
                            _context14.next = 7;
                            return regeneratorRuntime.awrap(this.processNode(node));

                        case 7:
                            _context14.next = 9;
                            return regeneratorRuntime.awrap(this.forwardProcess(node));

                        case 9:
                            _context14.next = 1;
                            break;

                        case 11:
                        case 'end':
                            return _context14.stop();
                    }
                }
            }, null, this);
        }
    }, {
        key: 'process',
        value: function process(data) {
            var startId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

            for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
                args[_key - 2] = arguments[_key];
            }

            return regeneratorRuntime.async(function process$(_context15) {
                while (1) {
                    switch (_context15.prev = _context15.next) {
                        case 0:
                            if (data instanceof Object) {
                                _context15.next = 2;
                                break;
                            }

                            throw new TypeError('Value of argument "data" violates contract.\n\nExpected:\nObject\n\nGot:\n' + _inspect$7(data));

                        case 2:
                            if (startId == null || typeof startId === 'number') {
                                _context15.next = 4;
                                break;
                            }

                            throw new TypeError('Value of argument "startId" violates contract.\n\nExpected:\n?number\n\nGot:\n' + _inspect$7(startId));

                        case 4:
                            if (this.processStart()) {
                                _context15.next = 6;
                                break;
                            }

                            return _context15.abrupt('return');

                        case 6:
                            if (this.validate(data)) {
                                _context15.next = 8;
                                break;
                            }

                            return _context15.abrupt('return');

                        case 8:

                            this.data = this.copy(data);
                            this.args = args;

                            _context15.next = 12;
                            return regeneratorRuntime.awrap(this.processStartNode(startId));

                        case 12:
                            _context15.next = 14;
                            return regeneratorRuntime.awrap(this.processUnreachable());

                        case 14:
                            return _context15.abrupt('return', this.processDone() ? 'success' : 'aborted');

                        case 15:
                        case 'end':
                            return _context15.stop();
                    }
                }
            }, null, this);
        }
    }]);
    return Engine;
}(Context);

function _inspect$7(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$7(input[0], depth);

            if (input.every(function (item) {
                return _inspect$7(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$7(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$7(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var EditorEvents = function (_Events) {
    inherits(EditorEvents, _Events);

    function EditorEvents() {
        classCallCheck(this, EditorEvents);
        return possibleConstructorReturn(this, (EditorEvents.__proto__ || Object.getPrototypeOf(EditorEvents)).call(this, {
            nodecreate: [],
            nodecreated: [],
            noderemove: [],
            noderemoved: [],
            connectioncreate: [],
            connectioncreated: [],
            connectionremove: [],
            connectionremoved: [],
            nodetranslate: [],
            nodetranslated: [],
            selectnode: [],
            nodeselect: [],
            nodeselected: [],
            rendernode: [],
            rendersocket: [],
            rendercontrol: [],
            renderconnection: [],
            componentregister: [],
            keydown: [],
            keyup: [],
            translate: [],
            zoom: [],
            click: [],
            mousemove: [],
            contextmenu: [],
            import: [],
            export: [],
            process: []
        }));
    }

    return EditorEvents;
}(Events);

var Drag = function () {
    function Drag(el) {
        var onTranslate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
        var onStart = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
        var onDrag = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : function () {};
        classCallCheck(this, Drag);

        this.mouseStart = null;

        this.el = el;
        this.onTranslate = onTranslate;
        this.onStart = onStart;
        this.onDrag = onDrag;

        el.addEventListener('mousedown', this.mousedown.bind(this));
        window.addEventListener('mousemove', this.mousemove.bind(this));
        window.addEventListener('mouseup', this.mouseup.bind(this));
    }

    createClass(Drag, [{
        key: 'mousedown',
        value: function mousedown(e) {
            e.stopPropagation();
            this.mouseStart = [e.pageX, e.pageY];

            this.onStart();
        }
    }, {
        key: 'mousemove',
        value: function mousemove(e) {
            if (!this.mouseStart) return;
            e.preventDefault();

            var delta = [e.pageX - this.mouseStart[0], e.pageY - this.mouseStart[1]];
            var zoom = this.el.getBoundingClientRect().width / this.el.offsetWidth;

            this.mouseStart = [e.pageX, e.pageY];

            this.onTranslate(delta[0] / zoom, delta[1] / zoom);
        }
    }, {
        key: 'mouseup',
        value: function mouseup(e) {
            this.mouseStart = null;

            this.onDrag();
        }
    }]);
    return Drag;
}();

var Zoom = function () {
    function Zoom(container, el, intensity, onzoom) {
        classCallCheck(this, Zoom);

        this.el = el;
        this.intensity = intensity;
        this.onzoom = onzoom;

        container.addEventListener('wheel', this.wheel.bind(this));
    }

    createClass(Zoom, [{
        key: 'wheel',
        value: function wheel(e) {
            e.preventDefault();

            var rect = this.el.getBoundingClientRect();
            var delta = e.wheelDelta / 120 * this.intensity;

            var ox = (rect.left - e.pageX) * delta;
            var oy = (rect.top - e.pageY) * delta;

            this.onzoom(delta, ox, oy);
        }
    }]);
    return Zoom;
}();

var Area = function (_Emitter) {
    inherits(Area, _Emitter);

    function Area(container, emitter) {
        classCallCheck(this, Area);

        if (!(emitter instanceof Emitter)) {
            throw new TypeError('Value of argument "emitter" violates contract.\n\nExpected:\nEmitter\n\nGot:\n' + _inspect$8(emitter));
        }

        var _this = possibleConstructorReturn(this, (Area.__proto__ || Object.getPrototypeOf(Area)).call(this, emitter));

        var el = _this.el = document.createElement('div');

        _this.container = container;
        _this.transform = { k: 1, x: 0, y: 0 };
        _this.mouse = [0, 0];

        el.style.transformOrigin = '0 0';

        _this._drag = new Drag(container, _this.onTranslate.bind(_this));
        _this._zoom = new Zoom(container, el, 0.1, _this.onZoom.bind(_this));
        _this.container.addEventListener('mousemove', _this.mousemove.bind(_this));

        _this.update();
        return _this;
    }

    createClass(Area, [{
        key: 'update',
        value: function update() {
            var t = this.transform;

            this.el.style.transform = 'translate(' + t.x + 'px, ' + t.y + 'px) scale(' + t.k + ')';
        }
    }, {
        key: 'mousemove',
        value: function mousemove(e) {
            var rect = this.el.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            var k = this.transform.k;

            this.trigger('mousemove', { x: x / k, y: y / k });
        }
    }, {
        key: 'onTranslate',
        value: function onTranslate(dx, dy) {
            this.translate(this.transform.x + dx, this.transform.y + dy);
        }
    }, {
        key: 'onZoom',
        value: function onZoom(delta, ox, oy) {
            this.zoom(this.transform.k * (1 + delta), ox, oy);

            this.update();
        }
    }, {
        key: 'translate',
        value: function translate(x, y) {
            if (!this.trigger('translate', { transform: this.transform, x: x, y: y })) return;

            this.transform.x = x;
            this.transform.y = y;

            this.update();
        }
    }, {
        key: 'zoom',
        value: function zoom(_zoom) {
            var ox = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
            var oy = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

            if (!this.trigger('zoom', { transform: this.transform, zoom: _zoom })) return;

            this.transform.k = _zoom;
            this.transform.x += ox;
            this.transform.y += oy;

            this.update();
        }
    }, {
        key: 'appendChild',
        value: function appendChild(el) {
            this.el.appendChild(el);
        }
    }, {
        key: 'removeChild',
        value: function removeChild(el) {
            this.el.removeChild(el);
        }
    }]);
    return Area;
}(Emitter);

function _inspect$8(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$8(input[0], depth);

            if (input.every(function (item) {
                return _inspect$8(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$8(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$8(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Control$1 = function (_Emitter) {
    inherits(Control, _Emitter);

    function Control(el, control, emitter) {
        classCallCheck(this, Control);

        var _this = possibleConstructorReturn(this, (Control.__proto__ || Object.getPrototypeOf(Control)).call(this, emitter));

        _this.trigger('rendercontrol', { el: el, control: control });
        return _this;
    }

    return Control;
}(Emitter);

var Socket$1 = function (_Emitter) {
    inherits(Socket, _Emitter);

    function Socket(el, type, io, node, emitter) {
        var _this$trigger;

        classCallCheck(this, Socket);

        var _this = possibleConstructorReturn(this, (Socket.__proto__ || Object.getPrototypeOf(Socket)).call(this, emitter));

        _this.el = el;
        _this.type = type;
        _this.io = io;
        _this.node = node;

        _this.trigger('rendersocket', (_this$trigger = { el: el }, defineProperty(_this$trigger, type, _this.io), defineProperty(_this$trigger, 'socket', io.socket), _this$trigger));
        return _this;
    }

    createClass(Socket, [{
        key: 'getPosition',
        value: function getPosition(_ref) {
            var position = _ref.position;

            var el = this.el;

            return [position[0] + el.offsetLeft + el.offsetWidth / 2, position[1] + el.offsetTop + el.offsetHeight / 2];
        }
    }]);
    return Socket;
}(Emitter);

var Node$1 = function (_Emitter) {
    inherits(Node, _Emitter);

    function Node(node, component, emitter) {
        classCallCheck(this, Node);

        var _this = possibleConstructorReturn(this, (Node.__proto__ || Object.getPrototypeOf(Node)).call(this, emitter));

        _this.node = node;
        _this.component = component;
        _this.sockets = new Map();
        _this.controls = new Map();
        _this.el = document.createElement('div');
        _this.el.style.position = 'absolute';

        _this.el.addEventListener('contextmenu', function (e) {
            return _this.trigger('contextmenu', { e: e, node: _this.node });
        });
        _this.drag = new Drag(_this.el, _this.onTranslate.bind(_this), _this.onSelect.bind(_this));

        _this.trigger('rendernode', {
            el: _this.el,
            node: node,
            component: component.data,
            bindSocket: _this.bindSocket.bind(_this),
            bindControl: _this.bindControl.bind(_this)
        });

        _this.update();
        return _this;
    }

    createClass(Node, [{
        key: 'bindSocket',
        value: function bindSocket(el, type, io) {
            if (!(el instanceof HTMLElement)) {
                throw new TypeError('Value of argument "el" violates contract.\n\nExpected:\nHTMLElement\n\nGot:\n' + _inspect$9(el));
            }

            if (!(typeof type === 'string')) {
                throw new TypeError('Value of argument "type" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$9(type));
            }

            if (!(io instanceof IO)) {
                throw new TypeError('Value of argument "io" violates contract.\n\nExpected:\nIO\n\nGot:\n' + _inspect$9(io));
            }

            this.sockets.set(io, new Socket$1(el, type, io, this.node, this));
        }
    }, {
        key: 'bindControl',
        value: function bindControl(el, control) {
            if (!(el instanceof HTMLElement)) {
                throw new TypeError('Value of argument "el" violates contract.\n\nExpected:\nHTMLElement\n\nGot:\n' + _inspect$9(el));
            }

            if (!(control instanceof Control)) {
                throw new TypeError('Value of argument "control" violates contract.\n\nExpected:\nControl\n\nGot:\n' + _inspect$9(control));
            }

            this.controls.set(control, new Control$1(el, control, this));
        }
    }, {
        key: 'getSocketPosition',
        value: function getSocketPosition(io) {
            return this.sockets.get(io).getPosition(this.node);
        }
    }, {
        key: 'onSelect',
        value: function onSelect() {
            this.trigger('selectnode', this.node);
        }
    }, {
        key: 'onTranslate',
        value: function onTranslate(dx, dy) {
            var node = this.node;
            var x = node.position[0] + dx;
            var y = node.position[1] + dy;

            if (!this.trigger('nodetranslate', { node: node, x: x, y: y })) return;

            this.translate(x, y);

            this.trigger('nodetranslated', { node: node });
        }
    }, {
        key: 'translate',
        value: function translate(x, y) {
            this.node.position[0] = x;
            this.node.position[1] = y;

            this.update();
        }
    }, {
        key: 'update',
        value: function update() {
            this.el.style.transform = 'translate(' + this.node.position[0] + 'px, ' + this.node.position[1] + 'px)';
        }
    }, {
        key: 'remove',
        value: function remove() {}
    }]);
    return Node;
}(Emitter);

function _inspect$9(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$9(input[0], depth);

            if (input.every(function (item) {
                return _inspect$9(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$9(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$9(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Connection$1 = function (_Emitter) {
    inherits(Connection, _Emitter);

    function Connection(connection, inputNode, outputNode, emitter) {
        classCallCheck(this, Connection);

        if (!(inputNode instanceof Node$1)) {
            throw new TypeError('Value of argument "inputNode" violates contract.\n\nExpected:\nViewNode\n\nGot:\n' + _inspect$10(inputNode));
        }

        if (!(outputNode instanceof Node$1)) {
            throw new TypeError('Value of argument "outputNode" violates contract.\n\nExpected:\nViewNode\n\nGot:\n' + _inspect$10(outputNode));
        }

        var _this = possibleConstructorReturn(this, (Connection.__proto__ || Object.getPrototypeOf(Connection)).call(this, emitter));

        _this.connection = connection;
        _this.inputNode = inputNode;
        _this.outputNode = outputNode;

        _this.el = document.createElement('div');
        _this.el.style.position = 'absolute';
        _this.el.style.zIndex = '-1';

        _this.update();
        return _this;
    }

    createClass(Connection, [{
        key: 'update',
        value: function update() {
            var _outputNode$getSocket = this.outputNode.getSocketPosition(this.connection.output),
                _outputNode$getSocket2 = slicedToArray(_outputNode$getSocket, 2),
                x1 = _outputNode$getSocket2[0],
                y1 = _outputNode$getSocket2[1];

            var _inputNode$getSocketP = this.inputNode.getSocketPosition(this.connection.input),
                _inputNode$getSocketP2 = slicedToArray(_inputNode$getSocketP, 2),
                x2 = _inputNode$getSocketP2[0],
                y2 = _inputNode$getSocketP2[1];

            this.trigger('renderconnection', { el: this.el, connection: this.connection, x1: x1, y1: y1, x2: x2, y2: y2 });
        }
    }]);
    return Connection;
}(Emitter);

function _inspect$10(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$10(input[0], depth);

            if (input.every(function (item) {
                return _inspect$10(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$10(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$10(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var EditorView = function (_Emitter) {
    inherits(EditorView, _Emitter);

    function EditorView(container, components, emitter) {
        classCallCheck(this, EditorView);

        if (!(container instanceof HTMLElement)) {
            throw new TypeError('Value of argument "container" violates contract.\n\nExpected:\nHTMLElement\n\nGot:\n' + _inspect$11(container));
        }

        if (!(components instanceof Object)) {
            throw new TypeError('Value of argument "components" violates contract.\n\nExpected:\nObject\n\nGot:\n' + _inspect$11(components));
        }

        if (!(emitter instanceof Emitter)) {
            throw new TypeError('Value of argument "emitter" violates contract.\n\nExpected:\nEmitter\n\nGot:\n' + _inspect$11(emitter));
        }

        var _this = possibleConstructorReturn(this, (EditorView.__proto__ || Object.getPrototypeOf(EditorView)).call(this, emitter));

        _this.container = container;
        _this.components = components;

        _this.container.style.overflow = 'hidden';

        _this.nodes = new Map();
        _this.connections = new Map();

        _this.container.addEventListener('click', _this.click.bind(_this));
        _this.container.addEventListener('contextmenu', function (e) {
            return _this.trigger('contextmenu', { e: e, view: _this });
        });
        window.addEventListener('resize', _this.resize.bind(_this));

        _this.on('nodetranslated', _this.updateConnections.bind(_this));

        _this.area = new Area(container, _this);
        _this.container.appendChild(_this.area.el);
        return _this;
    }

    createClass(EditorView, [{
        key: 'addNode',
        value: function addNode(node) {
            if (!(node instanceof Node)) {
                throw new TypeError('Value of argument "node" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$11(node));
            }

            var nodeView = new Node$1(node, this.components.get(node.name), this);

            this.nodes.set(node, nodeView);
            this.area.appendChild(nodeView.el);
        }
    }, {
        key: 'removeNode',
        value: function removeNode(node) {
            if (!(node instanceof Node)) {
                throw new TypeError('Value of argument "node" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$11(node));
            }

            var nodeView = this.nodes.get(node);

            this.nodes.delete(node);
            this.area.removeChild(nodeView.el);
        }
    }, {
        key: 'addConnection',
        value: function addConnection(connection) {
            if (!(connection instanceof Connection)) {
                throw new TypeError('Value of argument "connection" violates contract.\n\nExpected:\nConnection\n\nGot:\n' + _inspect$11(connection));
            }

            var viewInput = this.nodes.get(connection.input.node);
            var viewOutput = this.nodes.get(connection.output.node);
            var connView = new Connection$1(connection, viewInput, viewOutput, this);

            this.connections.set(connection, connView);
            this.area.appendChild(connView.el);
        }
    }, {
        key: 'removeConnection',
        value: function removeConnection(connection) {
            if (!(connection instanceof Connection)) {
                throw new TypeError('Value of argument "connection" violates contract.\n\nExpected:\nConnection\n\nGot:\n' + _inspect$11(connection));
            }

            var connView = this.connections.get(connection);

            this.connections.delete(connection);
            this.area.removeChild(connView.el);
        }
    }, {
        key: 'updateConnections',
        value: function updateConnections(_ref) {
            var _this2 = this;

            var node = _ref.node;

            node.getConnections().map(function (conn) {
                _this2.connections.get(conn).update();
            });
        }
    }, {
        key: 'resize',
        value: function resize() {
            var container = this.container;

            var width = container.parentElement.clientWidth;
            var height = container.parentElement.clientHeight;

            container.style.width = width + 'px';
            container.style.height = height + 'px';
        }
    }, {
        key: 'click',
        value: function click(e) {
            var container = this.container;

            if (container !== e.target) return;
            if (!this.trigger('click', { e: e, container: container })) return;
        }
    }]);
    return EditorView;
}(Emitter);

function _inspect$11(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$11(input[0], depth);

            if (input.every(function (item) {
                return _inspect$11(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$11(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$11(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var Selected = function () {
    function Selected() {
        classCallCheck(this, Selected);

        this.list = [];
    }

    createClass(Selected, [{
        key: 'add',
        value: function add(item) {
            var accumulate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

            if (!(item instanceof Node)) {
                throw new TypeError('Value of argument "item" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$12(item));
            }

            if (accumulate) {
                if (this.contains(item)) this.remove(item);else this.list.push(item);
            } else this.list = [item];
        }
    }, {
        key: 'clear',
        value: function clear() {
            var _this = this;

            this.each(function (item) {
                _this.remove(item);
            });
        }
    }, {
        key: 'remove',
        value: function remove(item) {
            this.list.splice(this.list.indexOf(item), 1);
        }
    }, {
        key: 'contains',
        value: function contains(item) {
            return this.list.indexOf(item) !== -1;
        }
    }, {
        key: 'each',
        value: function each(callback) {
            this.list.forEach(callback);
        }
    }]);
    return Selected;
}();

function _inspect$12(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$12(input[0], depth);

            if (input.every(function (item) {
                return _inspect$12(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$12(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$12(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var NodeEditor = function (_Context) {
    inherits(NodeEditor, _Context);

    function NodeEditor(id, container) {
        classCallCheck(this, NodeEditor);

        if (!(typeof id === 'string')) {
            throw new TypeError('Value of argument "id" violates contract.\n\nExpected:\nstring\n\nGot:\n' + _inspect$13(id));
        }

        if (!(container instanceof HTMLElement)) {
            throw new TypeError('Value of argument "container" violates contract.\n\nExpected:\nHTMLElement\n\nGot:\n' + _inspect$13(container));
        }

        var _this = possibleConstructorReturn(this, (NodeEditor.__proto__ || Object.getPrototypeOf(NodeEditor)).call(this, id, new EditorEvents()));

        _this.nodes = [];
        _this.components = new Map();

        _this.selected = new Selected();
        _this.view = new EditorView(container, _this.components, _this);

        window.addEventListener('keydown', function (e) {
            return _this.trigger('keydown', e);
        });
        window.addEventListener('keyup', function (e) {
            return _this.trigger('keyup', e);
        });
        _this.on('nodecreated', function (node) {
            return _this.getComponent(node.name).created(node);
        });
        _this.on('noderemoved', function (node) {
            return _this.getComponent(node.name).destroyed(node);
        });
        _this.on('selectnode', function (node) {
            return _this.selectNode(node);
        });
        return _this;
    }

    createClass(NodeEditor, [{
        key: 'addNode',
        value: function addNode(node) {
            if (!(node instanceof Node)) {
                throw new TypeError('Value of argument "node" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$13(node));
            }

            if (!this.trigger('nodecreate', node)) return;

            this.nodes.push(node);
            this.view.addNode(node);

            this.trigger('nodecreated', node);
        }
    }, {
        key: 'removeNode',
        value: function removeNode(node) {
            var _this2 = this;

            if (!(node instanceof Node)) {
                throw new TypeError('Value of argument "node" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$13(node));
            }

            if (!this.trigger('noderemove', node)) return;

            node.getConnections().forEach(function (c) {
                return _this2.removeConnection(c);
            });

            this.nodes.splice(this.nodes.indexOf(node), 1);
            this.view.removeNode(node);

            this.trigger('noderemoved', node);
        }
    }, {
        key: 'connect',
        value: function connect(output, input) {
            var data = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

            if (!(output instanceof Output)) {
                throw new TypeError('Value of argument "output" violates contract.\n\nExpected:\nOutput\n\nGot:\n' + _inspect$13(output));
            }

            if (!(input instanceof Input)) {
                throw new TypeError('Value of argument "input" violates contract.\n\nExpected:\nInput\n\nGot:\n' + _inspect$13(input));
            }

            if (!this.trigger('connectioncreate', { output: output, input: input })) return;

            try {
                var connection = output.connectTo(input);

                connection.data = data;
                this.view.addConnection(connection);

                this.trigger('connectioncreated', connection);
            } catch (e) {
                this.trigger('warn', e);
            }
        }
    }, {
        key: 'removeConnection',
        value: function removeConnection(connection) {
            if (!(connection instanceof Connection)) {
                throw new TypeError('Value of argument "connection" violates contract.\n\nExpected:\nConnection\n\nGot:\n' + _inspect$13(connection));
            }

            if (!this.trigger('connectionremove', connection)) return;

            this.view.removeConnection(connection);
            connection.remove();

            this.trigger('connectionremoved', connection);
        }
    }, {
        key: 'selectNode',
        value: function selectNode(node) {
            var accumulate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

            if (!(node instanceof Node)) {
                throw new TypeError('Value of argument "node" violates contract.\n\nExpected:\nNode\n\nGot:\n' + _inspect$13(node));
            }

            if (!(typeof accumulate === 'boolean')) {
                throw new TypeError('Value of argument "accumulate" violates contract.\n\nExpected:\nboolean\n\nGot:\n' + _inspect$13(accumulate));
            }

            if (this.nodes.indexOf(node) === -1) throw new Error('Node not exist in list');

            if (!this.trigger('nodeselect', node)) return;

            this.selected.add(node, accumulate);

            this.trigger('nodeselected', node);
        }
    }, {
        key: 'getComponent',
        value: function getComponent(name) {
            var component = this.components.get(name);

            if (!component) throw 'Component ' + name + ' not found';

            return component;
        }
    }, {
        key: 'register',
        value: function register(component) {
            if (!(component instanceof Component$1)) {
                throw new TypeError('Value of argument "component" violates contract.\n\nExpected:\nComponent\n\nGot:\n' + _inspect$13(component));
            }

            component.editor = this;
            this.components.set(component.name, component);
            this.trigger('componentregister', component);
        }
    }, {
        key: 'clear',
        value: function clear() {
            var _this3 = this;

            [].concat(toConsumableArray(this.nodes)).map(function (node) {
                return _this3.removeNode(node);
            });
        }
    }, {
        key: 'toJSON',
        value: function toJSON() {
            var data = { id: this.id, nodes: {} };

            this.nodes.forEach(function (node) {
                return data.nodes[node.id] = node.toJSON();
            });
            this.trigger('export', data);
            return data;
        }
    }, {
        key: 'beforeImport',
        value: function beforeImport(json) {
            if (!(json instanceof Object)) {
                throw new TypeError('Value of argument "json" violates contract.\n\nExpected:\nObject\n\nGot:\n' + _inspect$13(json));
            }

            var checking = Validator.validate(this.id, json);

            if (!checking.success) {
                this.trigger('warn', checking.msg);
                return false;
            }

            this.clear();
            this.silent = true;
            this.trigger('import', json);
            return true;
        }
    }, {
        key: 'afterImport',
        value: function afterImport() {
            this.silent = false;
            return true;
        }
    }, {
        key: 'fromJSON',
        value: function fromJSON(json) {
            var _this4 = this;

            var nodes;
            return regeneratorRuntime.async(function fromJSON$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            if (json instanceof Object) {
                                _context2.next = 2;
                                break;
                            }

                            throw new TypeError('Value of argument "json" violates contract.\n\nExpected:\nObject\n\nGot:\n' + _inspect$13(json));

                        case 2:
                            if (this.beforeImport(json)) {
                                _context2.next = 4;
                                break;
                            }

                            return _context2.abrupt('return', false);

                        case 4:
                            nodes = {};
                            _context2.prev = 5;
                            _context2.next = 8;
                            return regeneratorRuntime.awrap(Promise.all(Object.keys(json.nodes).map(function _callee(id) {
                                var node, component;
                                return regeneratorRuntime.async(function _callee$(_context) {
                                    while (1) {
                                        switch (_context.prev = _context.next) {
                                            case 0:
                                                node = json.nodes[id];
                                                component = _this4.getComponent(node.name);
                                                _context.next = 4;
                                                return regeneratorRuntime.awrap(component.build(Node.fromJSON(node)));

                                            case 4:
                                                nodes[id] = _context.sent;

                                                _this4.addNode(nodes[id]);

                                            case 6:
                                            case 'end':
                                                return _context.stop();
                                        }
                                    }
                                }, null, _this4);
                            })));

                        case 8:

                            Object.keys(json.nodes).forEach(function (id) {
                                var jsonNode = json.nodes[id];
                                var node = nodes[id];

                                jsonNode.outputs.forEach(function (outputJson, i) {
                                    outputJson.connections.forEach(function (jsonConnection) {
                                        var nodeId = jsonConnection.node;
                                        var data = jsonConnection.data;
                                        var inputIndex = jsonConnection.input;
                                        var targetInput = nodes[nodeId].inputs[inputIndex];

                                        _this4.connect(node.outputs[i], targetInput, data);
                                    });
                                });
                            });
                            _context2.next = 15;
                            break;

                        case 11:
                            _context2.prev = 11;
                            _context2.t0 = _context2['catch'](5);

                            this.trigger('warn', _context2.t0);
                            return _context2.abrupt('return', false);

                        case 15:
                            return _context2.abrupt('return', this.afterImport());

                        case 16:
                        case 'end':
                            return _context2.stop();
                    }
                }
            }, null, this, [[5, 11]]);
        }
    }]);
    return NodeEditor;
}(Context);

function _inspect$13(input, depth) {
    var maxDepth = 4;
    var maxKeys = 15;

    if (depth === undefined) {
        depth = 0;
    }

    depth += 1;

    if (input === null) {
        return 'null';
    } else if (input === undefined) {
        return 'void';
    } else if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return typeof input === 'undefined' ? 'undefined' : _typeof(input);
    } else if (Array.isArray(input)) {
        if (input.length > 0) {
            if (depth > maxDepth) return '[...]';

            var first = _inspect$13(input[0], depth);

            if (input.every(function (item) {
                return _inspect$13(item, depth) === first;
            })) {
                return first.trim() + '[]';
            } else {
                return '[' + input.slice(0, maxKeys).map(function (item) {
                    return _inspect$13(item, depth);
                }).join(', ') + (input.length >= maxKeys ? ', ...' : '') + ']';
            }
        } else {
            return 'Array';
        }
    } else {
        var keys = Object.keys(input);

        if (!keys.length) {
            if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
                return input.constructor.name;
            } else {
                return 'Object';
            }
        }

        if (depth > maxDepth) return '{...}';
        var indent = '  '.repeat(depth - 1);
        var entries = keys.slice(0, maxKeys).map(function (key) {
            return (/^([A-Z_$][A-Z0-9_$]*)$/i.test(key) ? key : JSON.stringify(key)) + ': ' + _inspect$13(input[key], depth) + ';';
        }).join('\n  ' + indent);

        if (keys.length >= maxKeys) {
            entries += '\n  ' + indent + '...';
        }

        if (input.constructor && input.constructor.name && input.constructor.name !== 'Object') {
            return input.constructor.name + ' {\n  ' + indent + entries + '\n' + indent + '}';
        } else {
            return '{\n  ' + indent + entries + '\n' + indent + '}';
        }
    }
}

var index = {
    Component: Component$1,
    Control: Control,
    NodeEditor: NodeEditor,
    Emitter: Emitter,
    Engine: Engine,
    Input: Input,
    Node: Node,
    Output: Output,
    Socket: Socket
};

return index;

})));
//# sourceMappingURL=rete.js.map