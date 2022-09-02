# Aspiration

A restricted way to do aspect oriented programming.

## Rationale

Aspect Oriented Programming (AOP) has proven to be an effective way keep cross-cutting concerns
(such as logging and validation) from cluttering a code base. However, it has also drawn justified
criticism for making code less transparent about what it is actually doing. Since the need for aspect
oriented programming arose in my own code bases, I tried to come up with a more restricted type of
AOP that is easier to reason about and nonetheless offers some of the same advantages as full-blown AOP.
As explained below, the key difference is that there is a single place in the code where callbacks
(known as "advise" in AspectJ terminology) are woven into the code. Therefore, to know what the
code is doing, there are only two places to look: the host function that triggers the callbacks, and the one
place where the callbacks are installed.

## A quick note on debugging

With Aspiration you can decorate your functions so that they can receive a callbacks object. To avoid stepping into the decorator function, add `/aspiration/` to the ignore list of your debugger.

## The host decorator

Assume that we have a function (let's call it the `host` function) that we wish to extend using AOP.
In the example below, the host function is `Selection.selectItem`. Currently, it does not yet take any
callbacks:

```
export type SelectionParamsT = {
  itemId: any;
  isShift?: boolean;
  isCtrl?: boolean;
};

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  selectItem(selectionParams: SelectionParamsT) {
    if (!this.selectableIds.contains(selectionParams.itemId)) {
      throw Error(`Invalid id: ${selectionParams.itemId}`);
    }
    // Do something to actually select an item.
    // We wish to use a callback function for this.
  }
}
```

Next we do three things:

- define a class that contains the callback functions
- use the `@host` decorator to indicate that we want our function to take callbacks.
- update the host function to accept the set of callbacks.

```
class Selection_selectItem extends Cbs {
  selectionParams: SelectionParamsT = stub();
  select() {}
}

type SelectionCbs {
  selectItem: Selection_selectItem;
}

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  @host(['selectionParams'])
  selectItem(selectionParams: SelectionParamsT) {
    return action((cbs: Selection_selectItem) => {
      if (!this.selectableIds.contains(selectionParams.itemId)) {
        throw Error(`Invalid id: ${selectionParams.itemId}`);
      }
      cbs.select();
    });
  }
}
```

Notes:

- The host() decorator takes (as its argument) the list of function argument names. It does this so that it can copy all function arguments to fields of the callbacks-object (`cbs`). In the future, when typescript makes it possible to use introspection to detect the argument names, the host() decorator will not require this argument anymore.

- The stub() function is a utility that returns `undefined` cast to `any`. It is used to prevent the
  Typescript checker from complaining about uninitialized callbacks-object members (these members receive
  their value when the host function is called).

## The setCallbacks function

At this point, the host function accepts callbacks, but we still have to implement them.
This is done with the `setCallbacks` function, which installs callbacks for every host function in the
host class instance.

```
const selection = new Selection();
setCallbacks(
  selection,
  {
    selectItem: {
      select(this: SelectionCbs['selectItem']) {
        console.log(`Make a selection using params ${this.selectionParams}`)
      },
      enter() {}, // do something when selectItem() is entered
      exit() {}, // do something when selectItem() is exited
    }
  } as SelectionCbs
)
```

Notes:

- we installed callbacks for `selectItem` in the `Selection` host class instance.
- each callback function has a `this` argument that is bound to the callbacks-object. This callbacks-object contains the host function arguments (in this case: `selectionParams`) as field values.
- you may specify a `enter` and `exit` callback that are called at the start and the end of
  the host function (i.e. `selectItem`). If you inspect the `Selection_selectItem` callbacks-object then you will see that it extends the `Cbs` baseclass that contains `enter` and `exit`.
- The explicit `this` argument in the `select` function is not strictly necessary, but it helps the reader
  of the code who will otherwise be surprised that `this` refers to the callbacks-object and not to the
  `Selection` instance.

## Type safety

In the code example above you can see that the second argument to `setCallbacks` is cast using `as SelectionCbs`.
By doing this, you force Typescript to check the types of the callbacks.

## Default callbacks

The current version of the `Selection` class does not work out of the box, because the caller needs to
implement the `select` callback using `setCallbacks`. To fix this you can specify a default set of callbacks when
you add the `@host` decorator:

```
// class Selection_select is the same as before

const selectItemDefaultCbs = (selection: Selection) => ({
  select: function (this: Selection_selectItem) {
    handleSelectItem(selection, this.selectionParams);
  },
});

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  // note that '@host' now takes an extra argument

  @host(['selectionParams'], selectItemDefaultCbs)
  selectItem(selectionParams: SelectionParamsT) {
    return action((cbs: Selection_select) => {
      if (!this.selectableIds.contains(selectionParams.itemId)) {
        throw Error(`Invalid id: ${selectionParams.itemId}`);
      }
      cbs.select();
    });
  }
}
```

In this case the `selection` instance will work even though we did not call `setCallbacks`.
Note that either Aspiration will either use the callbacks that were installed with `setCallbacks`
or the default ones, it does not ever try to merge them.

## Conclusion

Aspiration offers a light-weight and effective approach for extending functions with callbacks. It's used in much the
same way as other functions that take callbacks, but there are some differences. First of all, the callbacks are installed
in a single place, before the host functions are called. To predict the results of the host function, it's sufficient
to inspect this single location. Secondly, each callback function automatically gets access to the arguments of the host
function, which tends to reduce clutter in the code. This combination of features makes it possible to do Aspect Oriented
Programming in an agile and predictable manner.
