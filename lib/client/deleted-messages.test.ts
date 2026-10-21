import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readDeletedMessages, saveDeletedMessages, deletedMessageExpiry } from "./deleted-messages";
beforeEach(() => {
 const storage = new Map<string,string>();
 vi.stubGlobal("window", { localStorage: { getItem:(key:string)=>storage.get(key)??null, setItem:(key:string,value:string)=>storage.set(key,value) } });
});
afterEach(()=>vi.unstubAllGlobals());
it("persists deleted IDs across reloads and isolates accounts",()=>{
 saveDeletedMessages("alice",new Map([["message",deletedMessageExpiry()]]));
 expect(readDeletedMessages("alice").has("message")).toBe(true);
 expect(readDeletedMessages("bob").size).toBe(0);
 saveDeletedMessages("alice",new Map());
 expect(readDeletedMessages("alice").size).toBe(0);
});
it("ignores expired deletion markers",()=>{
 saveDeletedMessages("alice",new Map([["expired",Date.now()-1],["active",deletedMessageExpiry()]]));
 expect([...readDeletedMessages("alice").keys()]).toEqual(["active"]);
});
