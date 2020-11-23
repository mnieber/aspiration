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

# Reference documentation

## The exec function

Any function that accepts callbacks is decorated with the `@host` decorator. Inside a host function, you
can use the `exec` function to trigger a callback. The client should install one or more handlers for this
callback function. Here is an example:

```
class Selection {
  @observable selectableIds?: Array<string>;
  // other members omitted

  @host select({ itemId, isShift, isCtrl }) {
    if (!this.selectableIds.contains(itemId)) {
      throw Error(`Invalid id: ${itemId}`);
    }
    exec("selectItem");
  }
}
```

Notes:

1. From looking at the code we see that the `select` function expects the client to implement the "selectItem"
   to do the actual work. It's also possible to specify an optional callback using
   `exec("selectItem", { optional: true })`.

2. The callback function that is installed to handle "selectItem" will receive the same arguments as the host
   function. The reason for this design is that it makes the host function easier to read, and moreover, it
   means that any additional callback functions always receive the "full" information that was provided to the
   host function. We will later see how additional arguments can be passed to a callback function.

3. It's possible to receive a return value from the callback function, e.g. `const foo = exec("select")`. Note
   that there is no return type information, but we will see later how - to some extent - type checking with
   Typescript is still possible.

4. It's not possible to use `async` in a callback handler. However, the callback function may return a `Promise`.

## The setCallbacks function

We will now see how handlers can be installed, and how we can take additional action before and after a callback
is triggered.

```
function logSelect(this: Selection, { itemId, isShift, isCtrl }) {
    console.log(`About to select ${itemId}`)
}

function handleSelectItem(this: Selection, { itemId, isShift, isCtrl }) {
    // do something
}

function highlightItemAfterSelect(this: Selection, { itemId, isShift, isCtrl }) {
    // do something to highlight 'itemId'
}

function foo(selection: Selection) {
    setCallbacks(selection, {
        select: {
            enter: [() => console.log("enter")],
            selectItem_pre: [logSelect],
            selectItem: [handleSelectItem],
            selectItem_post: [highlightItemAfterSelect],
            exit: [() => console.log("exit")],
        }
    })
}
```

Notes:

0. The handler function may take a `this` parameter that has the type of the class that contains the
   host function. This allows callback function to inspect the state of the host class instance.

1. The signature of the "selectItem" callbacks must match the signature of the `Selection.select` function,
   otherwise Typescript will complain.
1. The "enter" and "exit" handlers are optional. They are triggered when the host function is entered
   and exited.

1. If you forget to install a required callback then a runtime error will be generated when the host function
   is executed.

1. In this example, the array of handlers for handling the "selectItem" callback contains a single function:
   `handleSelectItem`. If we specify multiple functions then all of them will be executed, and the return value of the last one will be returned to the host function.

1. We also install a handler for "selectItem_pre". This handler will be called before "selectItem" is triggered.

1. The handler for "selectItem*post*" will not be called **immediately** after "selectItem" is triggered. Instead,
   it will be called before the **next** callback is triggered. In the above example that would be the "exit"
   callback. The implication of this design is that the host function may do some more work after triggering
   "selectItem" and the handler of "selectItem_post" will see the state of the host class that reflects this
   extra work. Depending on the use-case, this may be a good or a bad thing. If "selectItem_post" must see the
   state immediately after "selectItem" finishes then you can explicitly insert "selectItem_post" as a callback
   in the host function.

## Additional callback parameters

As stated, each callback function is called with the arguments that are received by the host function. If the
host function wants to pass in additional arguments it can do so by expecting the callback function to return
a function that takes the additional parameters, like so:

```
  @host select({ itemId, isShift, isCtrl }) {
    if (!this.selectableIds.contains(itemId)) {
      throw Error(`Invalid id: ${itemId}`);
    }
    exec("selectItem")({ selectMultiple: true});
  }
```

The `handleSelectItem` can be implemented as follows to support this:

```
function handleSelectItem(this: Selection, { itemId, isShift, isCtrl }) {
    return (options: {selectMultiple: boolean}) => {
        // do something with all of the above arguments
    }
}
```

## Type safety

The Aspiration approach is not very typesafe, but some type safety is offered. First of
all the signature of the callback function must match the signature of the host function. Second, along with
the host class, we can publish a type with the signatures of the callback functions:

```
export type SelectionParamsT = {
  itemId: string;
  isShift: boolean;
  isCtrl: boolean;
}

export type SelectionOptionsT = {
  selectMultiple: boolean;
}

export type SelectionCbT {
  select: {
    selectItem: (params: SelectionParamsT) => (options: SelectionOptions) => void;
  }
}
```

We can use `SelectionCbT` when we call `setCallbacks`:

```
function foo(selection: Selection) {
    setCallbacks(selection, {
        select: {
            selectItem_pre: [logSelect],
            selectItem: [handleSelectItem],
            selectItem_post: [highlightItemAfterSelect],
        }
    } as SelectionCbT)  // Note: using SelectionCbT here
}
```

This gives the client the guarantee that they are passing in callbacks with the right signatures. However, it only
offers a limited type safety, since in the host function the call to `exec` remains unchecked. Also, the signatures
of `selectItem_pre` and `selectItem_post` are unchecked, because they do not appear in `SelectionCbT`.
Of course, other more type safe approaches are possible, but there is a trade-off: by sacrificing type safety somewhat,
Aspiration can achieve its goals with less code. In the end this was more important to me.
