/** Closed panels keep their exit animation and local draft state, but do not
 * rebuild their UI for unrelated chat events. Opening always receives fresh props. */
export function panelPropsEquality<T extends object>(closed: (props: T) => boolean, scope: (props: T) => unknown) {
  return (previous: T, next: T) => {
    if (closed(previous) && closed(next) && Object.is(scope(previous), scope(next))) return true;
    const keys = Object.keys(previous) as (keyof T)[];
    return keys.length === Object.keys(next).length && keys.every(key => Object.is(previous[key], next[key]));
  };
}
