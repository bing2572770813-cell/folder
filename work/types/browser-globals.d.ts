interface Window {
  __FOLD_FIELD_STANDALONE_SHELL__?: string;
  __FOLD_FIELD_GAME_ONLY__?: boolean;
  __FOLD_FIELD_EXPORT_MAP__?: unknown;
  __FOLD_FIELD_EXPORT_ASSETS__?: unknown;
  __FOLD_FIELD_COMPLETION_IMAGE__?: string;
  __FOLD_FIELD_DEATH_IMAGE__?: string;
  __FOLD_FIELD_PREFABS__?: Array<Record<string, unknown>>;
  __FOLD_FIELD_TAGS__?: Array<Record<string, unknown>>;
  foldField?: {
    enableDiagnostics: (enabled?: boolean) => void;
    getState: () => unknown;
    screenPoint: (row: number, column: number) => {x: number; y: number};
    reflect: (row: number, column: number, axis: unknown) => unknown;
  };
}
