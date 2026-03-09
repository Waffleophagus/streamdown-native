// biome-ignore-all lint/performance/noBarrelFile: package entrypoint intentionally re-exports public API.
export type { RemendHandler, RemendOptions } from "remend";
export { default as remend } from "remend";
export { parseMarkdownIntoBlocks } from "./parse-blocks";
export type {
  ExtractedStreamdownCodeBlock,
  ExtractedStreamdownCodeBlocks,
  ExtractStreamdownCodeBlocksOptions,
  StreamdownCodeBlockSnapshot,
  StreamdownCodeTokenSnapshot,
  StreamdownRenderSnapshot,
} from "./render-snapshot";
export {
  extractStreamdownCodeBlockMetadata,
  extractStreamdownCodeBlocks,
  hashStreamdownCodeBlock,
  hashStreamdownContent,
} from "./render-snapshot";
