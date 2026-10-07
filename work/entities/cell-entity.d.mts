export class VoidEntity {
  readonly prefabId: string;
  readonly r: number;
  readonly c: number;
  constructor(row: number, column: number, folds?: string[]);
  toJSON(): null;
}
export function inspectCell(map: Record<string, unknown>, row: number, column: number, isHidden?: (r: number, c: number) => boolean): Record<string, unknown> | VoidEntity;
