var EventEmitter = require('events').EventEmitter;
var Hash = require('traverse/hash');
var Chainsaw = require('chainsaw');

module.exports = Seq;
function Seq () {
    var context = {
        vars : {},
        args : {},
        stack : [].slice.call(arguments),
        error : null,
    };
    
    return Chainsaw(function (saw) {
        builder.call(this, saw, context);
    });
}

function builder (saw, context) {
    this.context = context;
    
    function action (key, f, g) {
        var cb = function (err) {
            var args = [].slice.call(arguments, 1);
            if (err) {
                context.stack = [ [err] ];
                var i = saw.actions
                    .map(function (x) { return x.name == 'catch' })
                    .indexOf(true)
                ;
                saw.actions.splice(i);
                saw.down('catch');
            }
            else {
                if (key === undefined) {
                    context.stack.push(args);
                }
                else {
                    context.vars[key] = args[0];
                    context.args[key] = args;
                }
                g(args, key);
            }
        };
        Hash(context).forEach(function (v,k) { cb[k] = v });
        cb.into = function (k) { key = k };
        f.apply(cb, context.stack.concat([cb]));
    }
    
    var running = 0;
    
    this.seq = function (key, cb) {
        if (cb === undefined) { cb = key; key = undefined }
        if (running == 0) {
            action(key, cb, saw.next);
        }
    };
    
    this.par = function (key, cb) {
        if (cb === undefined) { cb = key; key = undefined }
        
        running ++;
        action(key, cb, function () {
            running --;
            if (running == 0) saw.down('seq');
        });
        saw.next();
    };
    
    this.join = function (key, cb) {
        if (cb === undefined) { cb = key; key = undefined }
        saw.trap('seq', function () {
            if (running == 0) {
                action(key, cb, function () {
                    context.stack = [];
                    saw.next();
                });
            }
        });
    };
    
    this.catch = function (cb) {
        if (cb === undefined) { cb = key; key = undefined }
        context.emitter.on('result', function (err) {
            if (err) {
                context.emitter.removeListener('result', f);
                saw.next();
            }
        });
        action(key, cb);
    };
    
    this.push = function () {
        context.stack.push.apply(context.stack, arguments);
        saw.next();
    };
    
    this.extend = function (xs) {
        context.stack.push.apply(context.stack, xs);
        saw.next();
    };
    
    this.splice = function () {
        var args = [].slice.call(arguments);
        var cb = args.filter(function (arg) {
            return typeof arg == 'function'
        })[0];
        
        var xs = context.stack.splice.apply(context.stack, arguments);
        if (cb) saw.nest(cb, xs, context);
        else saw.next();
    };
    
    this.shift = function (cb) {
        var x = context.stack.shift();
        if (cb) saw.nest(cb, x, context);
        else saw.next();
    };
    
    this.do = function (cb) {
        saw.nest(cb, context);
    };
}
