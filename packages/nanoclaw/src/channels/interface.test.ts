import { afterEach, describe, expect, it } from "vitest";
import {
  type ChannelFactory,
  clearChannelRegistry,
  getChannelFactory,
  getRegisteredChannelNames,
  registerChannel,
} from "./interface.js";

describe("channel registry", () => {
  afterEach(() => {
    clearChannelRegistry();
  });

  it("getChannelFactory returns undefined for unknown channel", () => {
    expect(getChannelFactory("unknown")).toBeUndefined();
  });

  it("registerChannel + getChannelFactory round-trip", () => {
    const factory: ChannelFactory = () => null;
    registerChannel("test", factory);
    expect(getChannelFactory("test")).toBe(factory);
  });

  it("getRegisteredChannelNames includes registered", () => {
    registerChannel("telegram", () => null);
    registerChannel("discord", () => null);
    const names = getRegisteredChannelNames();
    expect(names).toContain("telegram");
    expect(names).toContain("discord");
  });

  it("later registration overwrites earlier (last-wins)", () => {
    const factory1: ChannelFactory = () => null;
    const factory2: ChannelFactory = () => ({
      name: "test",
      connect: async () => {},
      sendMessage: async () => {},
      disconnect: async () => {},
    });
    registerChannel("test", factory1);
    registerChannel("test", factory2);
    expect(getChannelFactory("test")).toBe(factory2);
  });

  it("factory returning null means channel not configured", () => {
    registerChannel("unconfigured", () => null);
    const factory = getChannelFactory("unconfigured");
    expect(factory).toBeDefined();
    if (!factory) return;
    const channel = factory({ onMessage: () => {} });
    expect(channel).toBeNull();
  });
});
