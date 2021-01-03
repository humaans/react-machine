# Changelog

## 0.3.0

Added some major API refinements on the way to 1.0.

#### Decomplecting machine context from state data

Decomplect machine context from state data, every hook now takes 2 arguments in place of `context` - `context` and `data`, where `context` is to be used similarly to how props are used in React, some context values can be passed in to be used in all of the reducers and effects (i.e. in the business logic), and data means state data (i.e. stateful data) that can only be mutated via reducers executed when entering, transitioning or leaving states.

#### Removing actions in favor of effects only

Remove the concept of actions (that run immediately during a transition) as it's not a Reacty concept - running side effects in the middle of a state update (useReducer dispatch) is not gonna work with concurrent mode. Instead, favor using `effect` which is not available not only in `enter` but in `exit` and every kind of transition (everywhere action was available before). This effect hook can be used to trigger side effects upon entering, transitioning or leaving states. They get queued up (all effects including along immediate transition edges) and get executed all at once once in a useEffect(). This means if multiple state updates get batched (e.g. in a single event handler), all of the effects will get collected and will get fired at once in a single useEffect call by React. This also means effects are now compatible with concurrent mode as component might simultaneously transition to different states in parallel, but only the one that gets committed will get the right set of effects executed (as effects are also stored in component state). Effects can be short lived - in a fire and forget manner, or they can return a cleanup function in case they are meant to be longe lived effects that start subscriptions or similar. The effect gets cleaned up upon leaving the current state. This applies to enter/exit/transition effects. E.g. when going from state A -> B, if A has an exit effect, it will be started, and will only be cleaned up when leaving B. Same applies to the transition effect that lead to B, same applies to B' enter effect. If you have a chain of immediate transitions of A -> B -> C -> D, where a single event causes the machine to go all the way from A to D, all reducers along the way will get executed and all effects along the way will get collected and executed.

## 0.2.0

First release 🎉. Thanks to @tempname11 for the npm package name.
