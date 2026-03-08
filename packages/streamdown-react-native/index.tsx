import type { RemendOptions } from "@streamdown/core";
import { parseMarkdownIntoBlocks, remend } from "@streamdown/core";
import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useState, useTransition } from "react";
import { Linking, View } from "react-native";
import {
  type AllowElement,
  type AnimateOptions,
  type CodeHighlighterPlugin,
  MarkdownNative,
  type UrlTransform,
} from "./lib/markdown-native";

export type StreamdownNativeMode = "streaming" | "static";

export interface StreamdownNativeProps {
  animated?: boolean | AnimateOptions;
  allowElement?: AllowElement;
  allowedElements?: readonly string[];
  children?: string;
  disallowedElements?: readonly string[];
  mode?: StreamdownNativeMode;
  isAnimating?: boolean;
  parseIncompleteMarkdown?: boolean;
  parseMarkdownIntoBlocksFn?: (markdown: string) => string[];
  plugins?: {
    code?: CodeHighlighterPlugin;
  };
  remend?: RemendOptions;
  onLinkPress?: (href: string) => void;
  unwrapDisallowed?: boolean;
  urlTransform?: UrlTransform;
}

/**
 * React Native Streamdown renderer (Phase 2 baseline).
 * - Streaming block orchestration and memoization
 * - RN-native markdown rendering (no WebView)
 */
const Block = memo(
  ({
    content,
    onLinkPress,
    animated,
    isAnimating,
    codePlugin,
    allowElement,
    allowedElements,
    disallowedElements,
    unwrapDisallowed,
    urlTransform,
  }: {
    animated?: AnimateOptions;
    allowElement?: AllowElement;
    allowedElements?: readonly string[];
    codePlugin?: CodeHighlighterPlugin;
    content: string;
    disallowedElements?: readonly string[];
    isAnimating?: boolean;
    onLinkPress?: (href: string) => void;
    unwrapDisallowed?: boolean;
    urlTransform?: UrlTransform;
  }) => {
    return (
      <MarkdownNative
        animated={animated}
        allowElement={allowElement}
        allowedElements={allowedElements}
        codePlugin={codePlugin}
        content={content}
        disallowedElements={disallowedElements}
        isAnimating={isAnimating}
        onLinkPress={onLinkPress}
        unwrapDisallowed={unwrapDisallowed}
        urlTransform={urlTransform}
      />
    );
  }
);

Block.displayName = "StreamdownNativeBlock";

export const Streamdown = ({
  animated,
  children,
  mode = "streaming",
  isAnimating = false,
  parseIncompleteMarkdown = true,
  parseMarkdownIntoBlocksFn = parseMarkdownIntoBlocks,
  plugins,
  remend: remendOptions,
  onLinkPress,
  allowElement,
  allowedElements,
  disallowedElements,
  unwrapDisallowed,
  urlTransform,
}: StreamdownNativeProps): ReactNode => {
  const [_isPending, startTransition] = useTransition();

  const processedChildren = useMemo(() => {
    if (typeof children !== "string") {
      return "";
    }
    if (mode === "streaming" && parseIncompleteMarkdown) {
      return remend(children, remendOptions);
    }
    return children;
  }, [children, mode, parseIncompleteMarkdown, remendOptions]);

  const blocks = useMemo(
    () => parseMarkdownIntoBlocksFn(processedChildren),
    [parseMarkdownIntoBlocksFn, processedChildren]
  );

  const [displayBlocks, setDisplayBlocks] = useState<string[]>(blocks);

  useEffect(() => {
    if (mode === "streaming" && !isAnimating) {
      startTransition(() => {
        setDisplayBlocks(blocks);
      });
    } else {
      setDisplayBlocks(blocks);
    }
  }, [blocks, mode, isAnimating]);

  const blocksToRender = mode === "streaming" ? displayBlocks : blocks;
  const animatedOptions: AnimateOptions | undefined =
    animated === true ? {} : animated === false ? undefined : animated;

  const handleLinkPress = (href: string) => {
    if (onLinkPress) {
      onLinkPress(href);
      return;
    }
    void Linking.openURL(href);
  };

  return (
    <View>
      {blocksToRender.map((block, index) => (
        <Block
          animated={animatedOptions}
          allowElement={allowElement}
          allowedElements={allowedElements}
          codePlugin={plugins?.code}
          content={block}
          disallowedElements={disallowedElements}
          key={`block-${index}`}
          isAnimating={isAnimating}
          onLinkPress={handleLinkPress}
          unwrapDisallowed={unwrapDisallowed}
          urlTransform={urlTransform}
        />
      ))}
    </View>
  );
};

export { parseMarkdownIntoBlocks, remend };
export type {
  AllowElement,
  CodeHighlighterPlugin,
  UrlTransform,
} from "./lib/markdown-native";
