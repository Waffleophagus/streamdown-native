import { describe, expect, it, vi } from "vitest";

const mockIsNativeEngineAvailable = vi.hoisted(() => vi.fn(() => true));
const mockCreateNativeEngine = vi.hoisted(() => vi.fn(() => ({ engine: "native" })));
const mockCodeToTokensBase = vi.hoisted(() =>
  vi.fn(async () => [[{ content: "const", color: "#ffffff" }]])
);
const mockCreateHighlighterCore = vi.hoisted(() =>
  vi.fn(async () => ({
    codeToTokensBase: mockCodeToTokensBase,
  }))
);

vi.mock("react-native-shiki-engine", () => ({
  createNativeEngine: mockCreateNativeEngine,
  isNativeEngineAvailable: mockIsNativeEngineAvailable,
}));

vi.mock("@shikijs/core", () => ({
  createHighlighterCore: mockCreateHighlighterCore,
}));

describe("@streamdown/code-native", () => {
  const langs = [{ id: "javascript" }];
  const themes = [{ name: "github-dark" }];

  it("throws when strict native engine is required but unavailable", async () => {
    mockIsNativeEngineAvailable.mockReturnValueOnce(false);
    const { createNativeCodePlugin } = await import("../index");
    expect(() =>
      createNativeCodePlugin({
        langs,
        themes,
      })
    ).toThrow("Native Shiki engine is unavailable");
  });

  it("supports languages and aliases", async () => {
    const { createNativeCodePlugin } = await import("../index");
    const plugin = createNativeCodePlugin({
      langs,
      themes,
      languageAliases: {
        js: "javascript",
      },
    });

    expect(plugin.name).toBe("shiki-native");
    expect(plugin.type).toBe("code-highlighter");
    expect(plugin.supportsLanguage("javascript")).toBe(true);
    expect(plugin.supportsLanguage("js")).toBe(true);
    expect(plugin.supportsLanguage("python")).toBe(false);
    expect(plugin.getThemes()).toEqual(["github-dark"]);
  });

  it("highlights asynchronously and returns cached result on repeat", async () => {
    const { createNativeCodePlugin } = await import("../index");
    const plugin = createNativeCodePlugin({
      langs,
      themes,
    });
    const callback = vi.fn();

    const first = plugin.highlight(
      {
        code: "const x = 1;",
        language: "javascript",
      },
      callback
    );
    expect(first).toBeNull();

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
    const resultFromCallback = callback.mock.calls[0][0];
    expect(resultFromCallback.tokens[0][0].content).toBe("const");

    const second = plugin.highlight({
      code: "const x = 1;",
      language: "javascript",
    });
    expect(second).not.toBeNull();
    expect(second?.tokens[0][0].content).toBe("const");
  });

  it("notifies multiple subscribers for an in-flight highlight", async () => {
    const { createNativeCodePlugin } = await import("../index");
    const plugin = createNativeCodePlugin({
      langs,
      themes,
    });
    const callbackOne = vi.fn();
    const callbackTwo = vi.fn();

    plugin.highlight(
      {
        code: "const y = 2;",
        language: "javascript",
      },
      callbackOne
    );
    plugin.highlight(
      {
        code: "const y = 2;",
        language: "javascript",
      },
      callbackTwo
    );

    await vi.waitFor(() => {
      expect(callbackOne).toHaveBeenCalledTimes(1);
      expect(callbackTwo).toHaveBeenCalledTimes(1);
    });
  });

  it("handles highlighter failures without throwing from highlight", async () => {
    mockCodeToTokensBase.mockImplementationOnce(async () => {
      throw new Error("synthetic highlight failure");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { createNativeCodePlugin } = await import("../index");
    const plugin = createNativeCodePlugin({
      langs,
      themes,
    });

    expect(() =>
      plugin.highlight({
        code: "const fail = true;",
        language: "javascript",
      })
    ).not.toThrow();

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    errorSpy.mockRestore();
  });
});
