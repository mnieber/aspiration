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
code is doing, there are only two places to look (the host function that absorps the callbacks, and the one
place where the callbacks are specified).

## The host decorator

Assume that we have a function (let's call it the `host` function) that we wish to extend using AOP.
In the example below, the host function is `Selection.select`. Currently, it does not yet take any
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

  select(selectionParams: SelectionParamsT) {
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
- use the `@host` decorator to indicate that we want our function to take callbacks
- update the host function to accept the set of callbacks

```
class Selection_select extends Cbs {
  selectionParams: SelectionParamsT;
  selectItem() {}
}

type SelectionCbs {
  select: Selection_select;
}

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  @host select(selectionParams: SelectionParamsT) {
    return action((cbs: Selection_select) => {
      if (!this.selectableIds.contains(selectionParams.itemId)) {
        throw Error(`Invalid id: ${selectionParams.itemId}`);
      }
      cbs.selectItem();
    });
  }
}
```

## The setCallbacks function

At this point, the host function accepts callbacks, but we still have to implement them.
This is done with the `setCallbacks` function, which installs callbacks for every host function in the
host class instance.
In the example below, we install callbacks for `select` in the `Selection` host class instance.
Notice first that the callback has a `this` argument that is bound to the callbacks object, and second that the
callbacks object contains the host function arguments (in this case: `selectionParams`).
Finally, note that you may specify a `enter` and `exit` callback that are called at the start and the end of
the host function. These special callbacks, that every callbacks object must have, are defined in the `Cbs` utility class. For this reason, `Selection_select` extends `Cbs`, though instead you could also add `enter` and `exit` directly to `Selection_select`.

```
const selection = new Selection();
setCallbacks(
  selection,
  {
    select: {
      selectItem(this: SelectionCbs['select']) {
        console.log(`Make a selection using params ${this.selectionParams}`)
      },
      enter() {}, // do something when select() is entered
      exit() {}, // do something when select() is exited
    }
  } as SelectionCbs
)
```

## Type safety

In the code example above you can see that the second argument to `setCallbacks` is cast using `as SelectionCbs`.
By doing this, you force Typescript to check the types of the callbacks.
The explicit `this` argument in the `selectItem` function is not strictly necessary, but it helps the reader
of the code who will otherwise be surprised that `this` refers to the callback object and not to the
`selection` object.

## Default callbacks

The current version of the `Selection` class does not work out of the box, because the caller needs to
implement the `select` callback. To fix this you can specify a default set of callbacks in the
`@host` decorator:

```
// class Selection_select is the same as before

const selectItemDefaultCbs = (selection: Selection) => ({
  selectItem: function (this: Selection_selectItem) {
    handleSelectItem(selection, this.selectionParams);
  },
});

class Selection {
  selectableIds?: Array<string>;
  ids: Array<string> = [];

  @host(selectItemDefaultCbs) select(selectionParams: SelectionParamsT) {
    return action((cbs: Selection_select) => {
      if (!this.selectableIds.contains(selectionParams.itemId)) {
        throw Error(`Invalid id: ${selectionParams.itemId}`);
      }
      cbs.selectItem();
    });
  }
}
```

In this case the `selection` instance will work even though we did not call `setCallbacks`. When
`selection.select()` is called, Aspiration will create the callbacks on the fly by calling
`selectItemDefaultCbs(selection)`. Note that either Aspiration will either use the callbacks that were
installed with `setCallbacks` or the default ones, it does not ever try to merge them.

## Conclusion

Aspiration offers a light-weight and effective approach for extending functions with callbacks. It's used in much the
same way as other functions that take callbacks, but there are some differences. First of all, the callbacks are installed
in a single place, before the host functions are called. To predict the results of the host function, it's sufficient
to inspect this single location. Secondly, each callback function automatically gets access to the arguments of the host
function, which tends to reduce clutter in the code. This combination of features makes it possible to do Aspect Oriented
Programming in an agile and predictable manner.
