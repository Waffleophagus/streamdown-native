import { createHighlighterCore } from "@shikijs/core";
import {
  createNativeEngine,
  isNativeEngineAvailable,
} from "react-native-shiki-engine";

export interface HighlightToken {
  bgColor?: string;
  color?: string;
  content: string;
  htmlAttrs?: Record<string, string>;
  htmlStyle?: Record<string, string>;
  offset?: number;
}

export interface HighlightResult {
  bg?: string;
  fg?: string;
  rootStyle?: string | false;
  tokens: HighlightToken[][];
}

export interface HighlightOptions {
  code: string;
  language: string;
}

export interface ThemeInput {
  name?: string;
}

export interface LanguageInput {
  id?: string;
  name?: string;
}

export interface CodePluginOptions {
  languageAliases?: Record<string, string>;
  langs: LanguageInput[];
  strictNativeEngine?: boolean;
  themes: ThemeInput[];
}

export interface NativeCodeHighlighterPlugin {
  getSupportedLanguages: () => string[];
  getThemes: () => string[];
  highlight: (
    options: HighlightOptions,
    callback?: (result: HighlightResult) => void
  ) => HighlightResult | null;
  isNativeEngineAvailable: () => boolean;
  name: "shiki-native";
  supportsLanguage: (language: string) => boolean;
  type: "code-highlighter";
}

const getThemeName = (theme: ThemeInput, fallback: string): string =>
  theme?.name ?? fallback;

const getLanguageId = (lang: LanguageInput): string =>
  (lang.id ?? lang.name ?? "").toLowerCase();

const createTokenCacheKey = (code: string, language: string, theme: string) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";
  return `${language}:${theme}:${code.length}:${start}:${end}`;
};

const mapTokens = (tokens: Array<Array<{ color?: string; content: string }>>) =>
  tokens.map((row) =>
    row.map((token) => ({
      content: token.content,
      color: token.color ?? "inherit",
      bgColor: "transparent",
      htmlStyle: {},
      offset: 0,
    }))
  );

export function createNativeCodePlugin(
  options: CodePluginOptions
): NativeCodeHighlighterPlugin {
  const strictNativeEngine = options.strictNativeEngine ?? true;
  const aliases = options.languageAliases ?? {};
  const langs = options.langs ?? [];
  const themes = options.themes ?? [];

  if (themes.length === 0) {
    throw new Error(
      "[@streamdown/code-native] `themes` is required. Pass at least one Shiki theme."
    );
  }
  if (langs.length === 0) {
    throw new Error(
      "[@streamdown/code-native] `langs` is required. Pass at least one Shiki language grammar."
    );
  }

  const nativeAvailable = isNativeEngineAvailable();
  if (strictNativeEngine && !nativeAvailable) {
    throw new Error(
      "[@streamdown/code-native] Native Shiki engine is unavailable. Ensure Expo prebuild/dev-client setup is complete."
    );
  }

  const supportedLanguages = new Set(
    langs.map(getLanguageId).filter((languageId) => languageId.length > 0)
  );
  const themeNames = themes.map((theme, index) =>
    getThemeName(theme, `theme-${index}`)
  );
  const primaryTheme = themeNames[0];

  let highlighterPromise: Promise<any> | null = null;
  const tokenCache = new Map<string, HighlightResult>();
  const subscribers = new Map<string, Set<(result: HighlightResult) => void>>();

  const getHighlighter = () => {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighterCore({
        engine: createNativeEngine(),
        langs: langs as any[],
        themes: themes as any[],
      });
    }
    return highlighterPromise;
  };

  const normalizeLanguage = (language: string): string => {
    const normalized = language.trim().toLowerCase();
    return aliases[normalized] ?? normalized;
  };

  return {
    name: "shiki-native",
    type: "code-highlighter",
    isNativeEngineAvailable: () => nativeAvailable,
    getSupportedLanguages: () => Array.from(supportedLanguages),
    getThemes: () => themeNames,
    supportsLanguage: (language: string) =>
      supportedLanguages.has(normalizeLanguage(language)),
    highlight(
      { code, language }: HighlightOptions,
      callback?: (result: HighlightResult) => void
    ): HighlightResult | null {
      const normalizedLanguage = normalizeLanguage(language);
      const languageToUse = supportedLanguages.has(normalizedLanguage)
        ? normalizedLanguage
        : Array.from(supportedLanguages)[0];
      const cacheKey = createTokenCacheKey(code, languageToUse, primaryTheme);

      const cachedResult = tokenCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      if (callback) {
        if (!subscribers.has(cacheKey)) {
          subscribers.set(cacheKey, new Set());
        }
        subscribers.get(cacheKey)?.add(callback);
      }

      void getHighlighter()
        .then((highlighter) =>
          highlighter.codeToTokensBase(code, {
            lang: languageToUse,
            theme: primaryTheme,
          })
        )
        .then((tokens: Array<Array<{ color?: string; content: string }>>) => {
          const result: HighlightResult = {
            bg: "transparent",
            fg: "inherit",
            tokens: mapTokens(tokens),
          };
          tokenCache.set(cacheKey, result);

          const queued = subscribers.get(cacheKey);
          if (queued) {
            for (const subscriber of queued) {
              subscriber(result);
            }
            subscribers.delete(cacheKey);
          }
        })
        .catch((error) => {
          console.error(
            "[@streamdown/code-native] Failed to highlight code:",
            error
          );
          subscribers.delete(cacheKey);
        });

      return null;
    },
  };
}
