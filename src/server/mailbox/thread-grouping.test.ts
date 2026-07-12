import { describe, expect, it } from "vitest";
import {
  threadKeyFromParts,
  shouldMergeThreads,
  parseReferences,
  normalizeSubject,
} from "./thread-grouping";

describe("thread-grouping", () => {
  it("groups replies by conversationId", () => {
    const parent = { conversationId: "abc-123" };
    const reply = { conversationId: "abc-123" };
    expect(shouldMergeThreads(parent, reply)).toBe(true);
  });

  it("falls back to References header", () => {
    const parent = {
      internetMessageId: "<parent@mail>",
      referencesHeader: null,
      inReplyTo: null,
      subject: "Annual review",
    };
    const reply = {
      internetMessageId: "<reply@mail>",
      referencesHeader: "<parent@mail>",
      inReplyTo: "<parent@mail>",
      subject: "Re: Annual review",
    };
    expect(threadKeyFromParts(parent)).toBe(threadKeyFromParts(reply));
  });

  it("handles subject-change forward with shared reference root", () => {
    const a = {
      referencesHeader: "<root@mail> <mid@mail>",
      subject: "Fwd: Portfolio update",
    };
    const b = {
      referencesHeader: "<root@mail>",
      subject: "Portfolio update",
    };
    expect(threadKeyFromParts(a)).toBe("ref:root@mail");
    expect(threadKeyFromParts(b)).toBe("ref:root@mail");
  });

  it("normalizes Re/Fwd subject prefixes", () => {
    expect(normalizeSubject("Re: Fwd: Meeting notes")).toBe("meeting notes");
  });

  it("parses References chain", () => {
    expect(parseReferences("<a@x> <b@y>")).toEqual(["a@x", "b@y"]);
  });
});
