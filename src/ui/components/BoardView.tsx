import type { Board, Cell, GameState } from "../../engine";

/** Ana tahta görünümü — kuralları uygulamaz, yalnızca durumu çizer. */
export function BoardView({
  state,
  targetCells,
}: {
  state: GameState;
  /** Ajanın seçtiği hedef hücreler (görsel vurgu) */
  targetCells: Set<string> | null;
}) {
  return (
    <div className="board" data-testid="board" role="grid" aria-label="Tetris tahtası">
      {state.board.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r}:${c}`;
          const isTarget = targetCells?.has(key) ?? false;
          return (
            <div
              key={key}
              role="gridcell"
              className={cellClass(cell, isTarget)}
              data-testid={`cell-${r}-${c}`}
            />
          );
        }),
      )}
    </div>
  );
}

function cellClass(cell: Cell, isTarget: boolean): string {
  if (cell !== null) return `cell ${cell}`;
  return isTarget ? "cell selected-target" : "cell";
}

/** Karar panelindeki küçük tahta önizlemesi. */
export function MiniBoard({ board }: { board: Board }) {
  return (
    <div
      className="mini-board"
      style={{ gridTemplateColumns: `repeat(${board[0].length}, 10px)` }}
      data-testid="mini-board"
    >
      {board.flatMap((row, r) =>
        row.map((cell, c) => (
          <div key={`${r}:${c}`} className={`mc ${cell ?? ""}`} />
        )),
      )}
    </div>
  );
}
