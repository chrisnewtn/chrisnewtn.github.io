---
title: "Asynchronicity in JavaScript: Callbacks"
description: "A short history and explainer on what callbacks in JavaScript are, their problems, and how to wrangle them."
emoji: ⚡
date-published: 2024-02-21
draft: true
template: post.template.html
tags:
  - blog
  - javascript
---

# Asynchronicity in JavaScript: Callbacks

JavaScript has three common approaches for dealing with asynchronicity.

1. Callbacks.
2. Promises.
3. Async/await.

These three approaches built on top of one another as they were introduced.

Two important topics for each approach are:

* How errors are handled.
* How async events are handled together. Either in sequence, in parallel, etc.

This is part explainer, part shallow history lesson. First, the classic: Callbacks.

Back before the language had formal constructs for handling asynchronicity, it had callbacks. Because JavaScript has always (as far as I know) had [first-class][first-class] functions, it was the tool available for the job. Just pass your function as a parameter to whatever's doing the asynchronous thing, and you're off to the races.

Below is a pretty classic example. The code is as era-appropriate as possible, so no `const` or [arrow functions][arrow-functions] or any of that fancy [Fetch][fetch] API.

```js
function request(method, url, callback) {
  var request = new XMLHttpRequest();

  request.addEventListener('load', function () {
    callback(null, request);
  });

  request.addEventListener('error', function () {
    callback(new Error('request error'), request);
  });

  request.open(method, url);
  request.send();
}

request('GET', 'https://chrisnewtn.com', function (error, req) {
  if (error) {
    console.error(error);
  } else {
    console.log('server responded ' + req.status);
  }
});
```

The `request` function is going to be our method of comparison between the three different approaches. It accepts HTTP `method`, `url` and `callback` parameters.

All the example is doing is making a `GET` request to [chrisnewtn.com](https://chrisnewtn.com) and logging the HTTP response code.

## "Errorbacks"

The first thing to note here is that there is no native way of dealing with errors, but I've used a pattern known as an "errorback" to get around that. This is a pattern [used by Node.js][errorback].

The first parameter is an `Error`, if there is one, `null` otherwise. The second parameter is used for whatever you wish the callback to yield. This way, if any callback yields a [truthy][truthy] fist parameter, you know something's wrong.

The problem with this is that it's just a convention. Not all callback interfaces use it, so dealing with errors is inconsistent.

## Missing errors

The bigger problem with callbacks and error handling is that asynchronous errors aren't handled in the same way as synchronous ones. The `request` function can yield an error, but it could throw as well.

In the example this could be forced by overwriting `XMLHttpRequest.prototype.send` to immediately throw. Doing so would lead to an uncaught error when calling `request`. The only ways of handling this is to either wrap every invocation of `request` in a try-catch, or to wrap request's function body in a try-catch. Neither are ideal.

```js
function request(method, url, callback) {
  try {
    var request = new XMLHttpRequest();

    request.addEventListener('load', function () {
      callback(null, request);
    });

    request.addEventListener('error', function () {
      callback(new Error('request error'), request);
    });

    request.open(method, url);
    request.send();
  } catch (error) {
    callback(error);
  }
}
```

## Mixed synchronicity

Another problem with callbacks is they are not always asynchronous.

```js
console.log(Date.now());
console.log(Date.now());
```

In the above example, the two logged timestamps should be identical. Both lines are next to one another. It's all synchronous code. They should be the same. No surprises there.

```js
function exampleSync(callback) {
  callback(Date.now());
}

exampleSync(function (time) {
  console.log(time);
  console.log(Date.now());
});
```

In `exampleSync` there's more code between the two dates, but it's still all happening synchronously. There's nothing magical about callbacks. The two dates should again be the same.

```js
function exampleAsync(callback) {
  setTimeout(callback, 0, Date.now());
}

exampleAsync(function (time) {
  console.log(time);
  console.log(Date.now());
});
```

Only now in `exampleAsync` should the dates differ. This is because `setTimeout`, even [with a delay of 0][settimeout-delay], guarantees that `callback` will be invoked on the next event cycle. This makes it asynchronous, meaning the dates will differ.

```js
function exampleMixed(callback) {
  if (Date.now() % 2 === 0) {
    setTimeout(callback, 0, Date.now());
  } else {
    callback(Date.now());
  }
}

exampleMixed(function (time) {
  console.log(time);
  console.log(Date.now());
});
```

This last example is the nightmare. It's a nightmare because not knowing whether the function you're invoking is going to resolve asynchronously or not can lead to race conditions, which are a pain to diagnose, let alone fix.

It's a contrived example, but a more realistic one might be validating some user input before submitting an API request. The API request, once submitted, still might return a user input error. One is sync, the other async. They both do the same thing, and the mixed approach can lead to inconsistent results which may be problematic without an obvious cause.

## Control flow

Until now, the examples have dealt with one async thing at a time. What about when it gets more complicated?

### Sequential operations

The simplest way of sequencing callbacks in JS is to nest them.

```js
request('GET', 'https://chrisnewtn.com', function (req) {
  console.log('first request: ' + req.status);

  request('GET', 'https://chrisnewtn.com', function (secondReq) {
    console.log('second request: ' + req.status);
  });
});
```

This works, but things can quickly get out of control.

```js
request('GET', 'https://chrisnewtn.com', function (req) {
  console.log('first request: ' + req.status);

  request('GET', 'https://chrisnewtn.com', function (secondReq) {
    console.log('second request: ' + req.status);

    request('GET', 'https://chrisnewtn.com', function (thirdReq) {
      console.log('third request: ' + req.status);

      request('GET', 'https://chrisnewtn.com', function (fourthReq) {
        console.log('fourth request: ' + req.status);

        request('GET', 'https://chrisnewtn.com', function (fifthReq) {
          console.log('fifth request: ' + req.status);
        });
      });
    });
  });
});
```

This is often called "callback hell", and is one of the problems I've heard cited for the development of promises.

### Parallel operations

Sometimes, you want two asynchronous things at once, then do something once they're both finished. With callbacks, there's no built-in, easy way of managing this. Here's my back of a napkin attempt:

```js
var completedRequests = 0;

function handleRequest(error, req) {
  completedRequests++;

  if (completedRequests === 2) {
    console.log('both requests are done');
  }
}

request('GET', 'https://chrisnewtn.com', handleRequest);
request('GET', 'https://chrisnewtn.com', handleRequest);
```

As you can see, you have to keep track of things yourself. There are libraries to help with this. A classic was [asyncjs][asyncjs]. The same example using that library looks like this:

```js
function onComplete(error, results) {
  console.log('both requests are done');
}

async.parallel([
  function (callback) {
    request('GET', 'https://chrisnewtn.com', callback);
  },
  function (callback) {
    request('GET', 'https://chrisnewtn.com', callback);
  }
], onComplete);
```

Having to rely on external libraries for basic control flow isn't ideal however. This problem, and others, is what Promises set out to solve.



[first-class]: https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function
[arrow-functions]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[errorback]: https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks#handling-errors-in-callbacks
[truthy]: https://developer.mozilla.org/en-US/docs/Glossary/Truthy
[settimeout-delay]: https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#delay
[asyncjs]: https://github.com/caolan/async/blob/v1.5.2/README.md
