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

## A quick note on debugging

With Aspiration you can decorate your functions so that they can receive a callbacks object. To avoid stepping into the decorator function, add `/aspiration/` to the ignore list of your debugger.

## The host decorator

Assume that we have a function (let's call it the `host` function) that we wish to extend using AOP.
In the example below, the host function is `Selection.selectItem`. Currently, it does not yet take any
callbacks:

```typescript
export type SelectionParamsT = {
  itemId: any;
  isShift?: boolean;
  isCtrl?: boolean;
};

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  selectItem(selectionParams: SelectionParamsT) {
    // Todo: validate selectionParams. We will use a callback function for this:
    // cbs.validate(this.selectableIds)

    this.ids = handleSelectItem(this.selectableIds, this.selectionParams);
  }
}
```

Our goal is to install a callbacks object that has a `validate` function, and use
this function inside `selectItem`. We will do this in two steps. First, we
extend `selectItem` so that it takes a callbacks object. Second, we will install
the callbacks object that has the `validate` function.

For the first step we do the following:

- define a class that contains the callback functions (a `Selection_selectItem` class that has a `validate` function);
- use the `@host` decorator to indicate that we want our function to take callbacks;
- use `getCallbacks` inside the host function to obtain the set of callbacks;
- use the callbacks in the host function (we will call `cbs.validate`).

```typescript
import { getCallbacks, stub } from 'aspiration';

class Selection_selectItem extends Cbs {
  selectionParams: SelectionParamsT = stub();
  validate(selectableIds: Array<string>) {}
}

type SelectionCbs {
  selectItem: Selection_selectItem;
}

class Selection {
  selectableIds: Array<string> = stub();
  ids: Array<string> = [];

  @host(['selectionParams'])
  selectItem(selectionParams: SelectionParamsT) {
    const cbs = getCallbacks(this) as SelectionCbs['selectItem'];
    cbs.validate(this.selectableIds);
    this.ids = handleSelectItem(this.selectableIds, this.selectionParams);
  }
}
```

Notes:

- The host() decorator takes (as its argument) the list of function argument names.
  It does this so that it can copy all function arguments to fields of the callbacks-object (`cbs`).
  In the future, when typescript makes it possible to use introspection to detect the argument names,
  the host() decorator will not require this argument anymore.

- The stub() function is a utility that returns `undefined` cast to `any`. It is used to prevent the
  Typescript checker from complaining about uninitialized callbacks-object members (these members receive
  their value when the host function is called).

## The setCallbackMap function

At this point, the host function uses callbacks, but we still have to define them.
This is done with the `setCallbackMap` function, which installs callbacks for every host function in the
host class instance.

```typescript
const selection = new Selection();
setCallbackMap(selection, {
  selectItem: {
    validate(this: SelectionCbs['selectItem'], selectableIds: string[]) {
      if (!selectableIds.contains(this.selectionParams.itemId)) {
        throw Error(`Invalid id: ${this.selectionParams.itemId}`);
      }
    },
    enter() {}, // do something when selectItem() is entered
    exit() {}, // do something when selectItem() is exited
  },
} as SelectionCbs);
```

Notes:

- we installed callbacks for `selectItem` in the `Selection` host class instance.
- each callback function has a `this` argument that is bound to the callbacks-object. This callbacks-object contains the host function arguments (in this case: `selectionParams`) as field values.
- you may specify a `enter` and `exit` callback that are called at the start and the end of
  the host function (i.e. `selectItem`). If you inspect the `Selection_selectItem` callbacks-object then you will see that it extends the `Cbs` baseclass that contains `enter` and `exit`.
- The explicit `this` argument in the `validate` function is not strictly necessary, but it helps the reader
  of the code who will otherwise be surprised that `this` refers to the callbacks-object and not to the `Selection` instance.

## Type safety

In the code example above you can see that the second argument to `setCallbackMap` is cast using `as SelectionCbs`.
By doing this, you force Typescript to check the types of the callbacks.

## Default callbacks

The current version of the `Selection` class forces the client to do some work does not work: it needs to
implement the `validate` callback using `setCallbackMap`. It would be nice to support a default implementation that works
out of the box. This can be done by specifying a default set of callbacks in the `@host` decorator:

```typescript
// class Selection_select is the same as before

const selectItemDefaultCbs = (selection: Selection) => ({
  validate(this: SelectionCbs['selectItem'], selectableIds: string[]) {
    if (!selectableIds.contains(this.selectionParams.itemId)) {
      throw Error(`Invalid id: ${this.selectionParams.itemId}`);
    }
  },
});

class Selection {
  selectableIds: Array<string> = stub();
  ids: Array<string> = [];

  // note that '@host' now takes an extra argument
  @host(['selectionParams'], selectItemDefaultCbs)
  selectItem(selectionParams: SelectionParamsT) {
    const cbs = getCallbacks(this) as SelectionCbs['selectItem'];
    cbs.validate(this.selectableIds);
    this.ids = handleSelectItem(this.selectableIds, this.selectionParams);
  }
}
```

In this case the `selection` instance will work even though we did not call `setCallbackMap`.
Note that Aspiration will either use the callbacks that were installed with `setCallbackMap`
or the default ones, it does not ever try to merge them.

## Be careful with your Promises

If you want to access the callbacks-object in the then-clause of a `Promise`, then you need to create
a local copy of the values you are interested in. It's not possible to access `this` inside the
then-clause. In the example below, we see that `this.selectionParams` is cached.

```typescript
setCallbackMap(selection, {
  selectItem: {
    validate(this: SelectionCbs['selectItem'], selectableIds: string[]) {
      const params = this.selectionParams;
      postUserAction('selectItem', params).then(() => console.log(params));
    },
  },
} as SelectionCbs);
```

## An alternative way to declare the callbacks object

The `Selection_selectItem` class above is repeating the arguments of the host function.
Moreover, it's a bit clunky to introduce a separate class (such as `Selection_selectItem`)
for every function in `Selection` that takes callbacks. If all host functions have a single argument
called `args` then we can use the DefineCbs helper function to declare `SelectionCbs`:

```ts
type Cbs = {
  selectItem: {
    validate(selectableIds: string[]): void;
  };
  // You can declare the callback objects for the other functions in
  // Selection below (we don't need separate classes such as Selection_selectItem).
};

export type SelectionCbs = DefineCbs<Selection, Cbs>;
```

Remember that this works if the host function has a single argument that is called `args`.
Inside of the `args` argument, we can declare all arguments that the host function requires,
so this approach does not impose any real limitations.

## Conclusion

Aspiration offers a light-weight and effective approach for extending functions with callbacks. It's used in much the
same way as other functions that take callbacks, but there are some differences. First of all, the callbacks are installed
in a single place, before the host functions are called. To predict the results of the host function, it's sufficient
to inspect this single location. Secondly, each callback function automatically gets access to the arguments of the host
function, which tends to reduce clutter in the code. This combination of features makes it possible to do Aspect Oriented
Programming in an agile and predictable manner.
