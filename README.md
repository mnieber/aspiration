# Aspiration

A restricted way to do aspect oriented programming.

## Rationale

Aspect Oriented Programming (AOP) has proven to be an effective way keep cross-cutting concerns
(such as logging and validation) from cluttering a code base. However, it has also drawn justified
criticism for making code less transparent about what it is actually doing. Since the need for aspect
oriented programming arose in my own code bases, I tried to come up with a more restricted type of
AOP that is easier to reason about and nonetheless offers some of the same advantages as full-blown AOP.
The main idea is that instead of extending a function F with pointcuts (as we do in AOP), we can extend
it with callback functions. We then implement these callback functions in a single place. When a client
calls F, then the callbacks are executed (so that things such as logging and validation are performed).
In order to understand what F really does, we only need to look at F's body, and at the single place
where F's callbacks are implemented.

## Debugging

With Aspiration you can wrap your functions so that they can receive a callbacks object.
To avoid stepping into the wrapper function, add `/aspiration/` to the ignore list of your debugger.

## A quick note on the history of this library

This library used to be more complex. I realized I could achieve the same goals in a simpler way.
Fortunately, very likely, no one except for myself ever used the old version.

## The withCbs wrapper function

Assume that we have a class (that I shall call the `container`) with a function (let's call it the `host` function)
that we wish to extend using AOP. In the example below, the host function is `Selection.selectItem`. Currently,
it does not yet take any callbacks:

```typescript
export type SelectionParamsT = {
  itemId: any;
  isShift?: boolean;
  isCtrl?: boolean;
};

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  selectItem(args: { selectionParams: SelectionParamsT }) {
    // Todo: validate selectionParams. We will use a callback function for this:
    // cbs.validate(this.selectableIds)

    this.ids = handleSelectItem(this.selectableIds, args.selectionParams);
  }
}
```

Our goal is to install a callbacks object that has a `validate` function, and use
this function inside `selectItem`. We will do this in three steps:

- First, we will add a callback-map in container class.
- Then, we'll update the host function so that it uses the callback-map.
- Finally, we'll implement the callbacks in the client code.

For the first two steps, we'll make the following changes:

```ts
import { withCbs, type CallbackMap } from 'aspiration';

class Selection {
  // The CallbackMap type adds the enter() and exit() callbacks that
  // will be discussed later.
  callbackMap = {} as CallbackMap<{
    selectItem: {
      validate: (selectableIds: string[]) => void;
    };
  }>;

  // ...

  selectItem(args: { selectionParams: SelectionParamsT }) {
    return withCbs(this.callbackMap, 'selectItem', args, (cbs) => {
      cbs.validate(this.selectableIds);
      // ...
    });
  }
}
```

As you can see, the approach is very simple. The container instance has a `callbackMap` object with
callback functions that can be used in any of the member functions. The host function uses the `callbackMap`
by passing it to `withCbs`. Then, `withCbs` does the following:

- it constructs a callbacks-object (`cbs`) that is a copy of `this.callbackMap['selectItem]`;
- it calls `cbs.enter()` (if this function exists);t
- it executes the body of the host function (the last argument of `withCbs`), passing in
  the callbacks-object. It stores the return value;
- it calls `cbs.exit()` (if this function exists);
- it returns the return value.

The callbacks-object contains a copy of the host function arguments, so that each callback has access to
these arguments via `this.args` (we shall see this in action later).

Now all that remains to be done is to install the callback functions.

```ts
import { type Cbs } from 'aspiration';

const selection = new Selection();

selection.callbackMap = {
  selectItem: {
    validate(this: Cbs<Selection['selectItem']>, selectableIds: string[]) {
      if (!selectableIds.contains(this.args.selectionParams.itemId)) {
        throw Error(`Invalid id: ${this.args.selectionParams.itemId}`);
      }
    },
    // Log selectionParams when selectItem() is entered
    enter(this: Cbs<Selection['selectItem']>) {
      console.log(this.args.selectionParams);
    },
    // do something when selectItem() is exited
    exit() {},
  },
};
```

The `Cbs<Selection['selectItem']>` type contains the definition of the callbacks-object of
the `selectItem` host function, including the `enter()` and `exit()` callbacks, and including
the `this.args` object with the arguments of the host function. In the implementation of the
`enter` callback, we see an example of using `this.args`.

## Type safety

In general, this approach is type-safe. However, the programmer has to make sure that the
correct type is used in the definition of `this` in the callback implementation
(e.g. `Cbs<Selection['selectItem']>`).

## Default callbacks

The current version of the `Selection` class forces the client to do some work: it needs to
implement the `validate` callback using `setCallbackMap`. It would be nice to support a default implementation that works
out of the box. This can be done by merging with a default callbackMap:

```ts
import { mergeDeepLeft, withCbs, type CallbackMap } from 'aspiration';

const defaultCallbackMap = (selection: Selection) => ({
  selectItem: {
    validate: (this: Cbs<Selection['selectItem']>) {
      handleValidation(selection, this.args.selectionParams);
    }
  }
});

class Selection {
  callbackMap_ = {} as CallbackMap<{
    // The selectItem callbacks are now optional
    selectItem?: {
      // If you choose to implement the selectItem callbacks, then validate is optional
      validate?: (selectableIds: string[]) => void;
    }
  }>;

  get callbackMap() {
    return this.callbackMap_;
  }

  set callbackMap(cbs: typeof this.callbackMap_) {
    this.callbackMap_ = mergeDeepLeft(cbs, defaultCallbackMap(this));
  }

  // ...
}
```

In this case the `selection` instance will work even when the client doesn't implement
the callback-map.

## Be careful with your Promises

If you want to access the callbacks-object in the then-clause of a `Promise`, then you need to create
a local copy of the values you are interested in. It's not possible to access `this` inside the
then-clause. In the example below, we see that `this.args.selectionParams` is cached.

```typescript
setCallbackMap(selection, {
  selectItem: {
    validate(this: SelectionCbs['selectItem'], selectableIds: string[]) {
      const params = this.args.selectionParams;
      Promise.resolve().then(() => console.log(params));
    },
  },
} as SelectionCbs);
```

## Conclusion

Aspiration offers a light-weight and effective approach for extending functions with callbacks. It's used in much the
same way as other functions that take callbacks, but there are some differences. First of all, the callbacks are installed
in a single place, before the host functions are called. Secondly, each callback function automatically gets access to the
arguments of the host function, which tends to reduce clutter in the code. To predict the results of the host function,
it's sufficient to inspect its definition, as well as the location where the callbacks are implemented. This combination of
features makes it possible to do Aspect Oriented Programming in an agile and predictable manner.
