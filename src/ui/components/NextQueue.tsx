import { shapeOf } from "../../engine";
import type { PieceType } from "../../engine";

/** Sıradaki parçaların önizlemesi. */
export function NextQueue({ next }: { next: PieceType[] }) {
  return (
    <div className="next-queue" data-testid="next-queue">
      <h2>Sıradaki</h2>
      {next.length === 0 && <span className="no-data">veri yok</span>}
      {next.map((type, index) => (
        <NextPiece key={`${index}-${type}`} type={type} />
      ))}
    </div>
  );
}

function NextPiece({ type }: { type: PieceType }) {
  const shape = shapeOf(type, 0);
  // Kenar boş satır/sütunları kırparak kompakt önizleme üretir.
  const trimmed = trim(shape);
  return (
    <div
      className="next-piece"
      style={{ gridTemplateColumns: `repeat(${trimmed[0].length}, 12px)` }}
      aria-label={`Sıradaki parça: ${type}`}
    >
      {trimmed.flatMap((row, r) =>
        row.map((filled, c) => (
          <div
            key={`${r}:${c}`}
            className={`mini-cell ${filled ? type : ""}`}
            style={filled ? { background: pieceColor(type) } : undefined}
          />
        )),
      )}
    </div>
  );
}

function trim(shape: number[][]): number[][] {
  let top = 0;
  let bottom = shape.length - 1;
  let left = 0;
  let right = shape[0].length - 1;
  while (top < bottom && shape[top].every((v) => v === 0)) top++;
  while (bottom > top && shape[bottom].every((v) => v === 0)) bottom--;
  while (left < right && shape.every((row) => row[left] === 0)) left++;
  while (right > left && shape.every((row) => row[right] === 0)) right--;
  return shape
    .slice(top, bottom + 1)
    .map((row) => row.slice(left, right + 1));
}

export function pieceColor(type: PieceType): string {
  const colors: Record<PieceType, string> = {
    I: "#22d3ee",
    O: "#facc15",
    T: "#a78bfa",
    S: "#4ade80",
    Z: "#f87171",
    J: "#60a5fa",
    L: "#fb923c",
  };
  return colors[type];
}
