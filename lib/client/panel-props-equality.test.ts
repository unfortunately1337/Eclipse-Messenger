import { expect, it } from "vitest";
import { panelPropsEquality } from "./panel-props-equality";
type Props = { open: boolean; owner: string; value: number; callback: () => void };
const compare = panelPropsEquality<Props>(props => !props.open, props => props.owner);
const closed: Props = { open: false, owner: "alice", value: 1, callback: () => {} };
it("skips unrelated closed panel updates but opens with current callbacks and data", () => {
  expect(compare(closed, { ...closed, value: 2, callback: () => {} })).toBe(true);
  expect(compare(closed, { ...closed, open: true, value: 2 })).toBe(false);
});
it("does not skip closing, account changes or updates while open", () => {
  expect(compare({ ...closed, open: true }, closed)).toBe(false);
  expect(compare(closed, { ...closed, owner: "bob" })).toBe(false);
  expect(compare({ ...closed, open: true }, { ...closed, open: true, value: 2 })).toBe(false);
  expect(compare({ ...closed, open: true }, { ...closed, open: true })).toBe(true);
});
