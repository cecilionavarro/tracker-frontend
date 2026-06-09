import { useSyncExternalStore } from "react"

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual: (a: Selection, b: Selection) => boolean = Object.is
) {
  void isEqual

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot ?? getSnapshot
  )
  return selector(snapshot)
}
