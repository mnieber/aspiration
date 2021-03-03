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
  @observable selectableIds?: Array<string>;
  // other members omitted

  select(selectionParams: SelectionParamsT) {
    const { itemId, isShift, isCtrl } = selectionParams;
    if (!this.selectableIds.contains(itemId)) {
      throw Error(`Invalid id: ${itemId}`);
    }
    // Do something to actually select an item.
    // We wish to use a callback function for this.
  }
}
```

Next we do three things:

- define a class that contains the callback functions
- use the `@host` decorator to indicate that we want our function to take callbacks
- change the host function to accept the set of callbacks

```
class Selection_select {
  selectionParams: SelectionParamsT;
  selectItem() {}
}

class Selection {
  @observable selectableIds?: Array<string>;
  // other members omitted

  @host select(selectionParams: SelectionParamsT) {
    return (cbs: Selection_select) => {
      const { itemId, isShift, isCtrl } = selectionParams;
      if (!this.selectableIds.contains(itemId)) {
        throw Error(`Invalid id: ${itemId}`);
      }
      cbs.selectItem();
    }
  }
}
```

## The addCallbacks function

At this point, the host function accepts callbacks, but we still have to implement them.
This is done with the `addCallbacks` function, which installs callbacks for every host function in the
host class instance.
In the example below, we install callbacks for `select` in the `Selection` host class instance.
Notice first that the callback has a `this` argument that is bound to the callbacks object, and second that the
callbacks object contains the host function arguments (in this case: `selectionParams`). Finally, note that
you may specify a `enter` and `exit` callback that are called at the start and the end of the host function.

```
const selection = new Selection();
addCallbacks(
  selection,
  {
    select: {
      selectItem(this: Selection_select) {
        console.log(`Make a selection using params ${this.selectionParams}`)
      },
      enter(this: Selection_select) {},
      exit(this: Selection_select) {},
    }
  }
)
```

## Type safety

The Aspiration approach is not completely typesafe, because there is no check that the callbacks that are
installed with `addCallbacks` match the expected callbacks. The `addCallbacks` function will however complain
if you forgot to specify a callback. And on the plus side, since a type (`Selection_select`) is used inside the
host function and inside the callback functions, you will get errors if you use the callbacks object incorrectly.
Another important thing to keep in mind is that Aspiration looks at the argument names in the host function. The arguments
in the host function should have corresponding fields (with the same names) in the callbacks object, so that Aspiration
can copy these values to the callbacks object.
