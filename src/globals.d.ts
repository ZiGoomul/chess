/// <reference types="jquery" />

interface ChessboardStatic {
  (containerElOrId: string | Element, config?: Record<string, unknown>): any;
  objToFen(position: Record<string, string>): string;
  fenToObj(fen: string): Record<string, string> | false;
}

interface Window {
  $: JQueryStatic;
  jQuery: JQueryStatic;
  Chessboard: ChessboardStatic;
  webkitAudioContext?: typeof AudioContext;
}

declare const Chessboard: ChessboardStatic;

declare module '*?url' {
  const url: string;
  export default url;
}
