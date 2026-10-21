import { expect, it } from "vitest";
import { getReplyLineColor } from "./reply-colors";
it("uses a gray rule on the default white bubble and a light rule on a dark bubble",()=>{
 expect(getReplyLineColor('#ffffff')).toBe('#9ca3af');
 expect(getReplyLineColor('#212121')).toBe('#e4e4e7');
});
it("keeps readable custom colors and repairs colors that disappear on their surface",()=>{
 expect(getReplyLineColor('#ffffff','#446688')).toBe('#446688');
 expect(getReplyLineColor('#212121','#212121')).not.toBe('#212121');
 expect(getReplyLineColor('#ffffff','#ffffff')).toBe('#9ca3af');
});
it("uses the bubble hue for colored themes and handles mixed light/dark gradients",()=>{
 const blue=getReplyLineColor('linear-gradient(180deg, #2563eb, #1943b3)');
 const purple=getReplyLineColor('linear-gradient(180deg, #7c3aed, #4c1d95)');
 expect(blue).not.toBe(purple);expect(blue).not.toBe('#2563eb');
 expect(getReplyLineColor('linear-gradient(180deg, #000000, #ffffff)')).not.toBe('#ffffff');
});
