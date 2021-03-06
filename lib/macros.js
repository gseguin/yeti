// A collection of functions for unit tests.

var assert = require("assert");

var server = require("./server");
var http = require("./http");

// A starting server port number.
var _port = 8099;

// Factory for server port numbers.
function getPort () {
    return _port++;
}

// Returns a function that makes an HTTP request.
// It'll make a `method` request to `path` with `body`.
// Expects to get `code` response back.
function request (code, path, body, method) {
    if (!code) code = 200;
    var options = {
        host : "localhost",
        method : "GET",
        path : path
    };
    if (body) options.body = body;
    if (method) options.method = method;
    return function (lastTopic) {
        var vow = this;
        // try to find port number
        var port = Array.prototype.slice.call(arguments, -1)[0];
        if (!isNaN(port))
            options.port = port;
        else throw new Error("Unable to determine port from topic.");
        if ("function" === typeof path)
            options.path = path(lastTopic);
        else if (!path)
            options.path = vow.context.name.split(/ +/)[1];
        http.request(
            options
        ).on("response", function X (res, results) {
            var err = null;
            if (res.statusCode !== code)
                err = options.method + " " + options.path
                      + ": " + res.statusCode
                      + " " + require("http").STATUS_CODES[res.statusCode]
                      + ": " + results;
            if (res.statusCode === 302) { // handle redirects
                options.path = res.headers.location;
                return http.request(options).on("response", X);
            }
            if (res.statusCode === 404 && !options._404) {
                // When Yeti gives a 404, the resource may be available
                // in the future. Wait a moment then try again.
                // This typically happens when requesting /status
                // and a browser, using XHR transport, hasn't
                // reconnected before the test demands its status.
                options._404 = true;
                return setTimeout(function () {
                    http.request(options).on("response", X);
                }, 12000);
            }
            vow.callback(err, results);
        });
    }
}

// Returns a topic function that'll start Yeti on a new port.
function httpify () {
    var port = getPort();
    return function() {
        var vows = this;
        var cwd = process.cwd().split("/");
        if (
            "test" != cwd[cwd.length - 1]
        ) cwd.push("test");
        // the config.path is set to the test dir
        // everything outside shouldn't be served
        // (cli.js sets config.path to your cwd)
        server.serve(port, cwd.join("/"), function (err) {
            vows.callback(err, port);
        });
    };
}

module.exports = {
    request : request,
    httpify : httpify
}; 
