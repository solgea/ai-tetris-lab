import { describe, expect, it } from "vitest";
import {
  PIECE_TYPES,
  ROTATIONS,
  normalizeRotation,
  rotateMatrixCW,
  shapeOf,
} from "../../src/engine";

describe("tetromino şekilleri", () => {
  it("yedi standart parça tanımlı", () => {
    expect(PIECE_TYPES).toEqual(["I", "O", "T", "S", "Z", "J", "L"]);
  });

  it("her doğuş şekli tam 4 dolu hücreye sahiptir", () => {
    for (const type of PIECE_TYPES) {
      const shape = shapeOf(type, 0);
      const filled = shape.flat().filter((v) => v === 1).length;
      expect(filled, `${type} parçası 4 hücre olmalı`).toBe(4);
    }
  });

  it("her parçanın 4 döndürmesi vardır ve döngüsel olarak başa döner", () => {
    for (const type of PIECE_TYPES) {
      expect(ROTATIONS[type].length).toBe(4);
      expect(shapeOf(type, 4)).toEqual(shapeOf(type, 0));
      expect(normalizeRotation(-1)).toBe(3);
    }
  });

  it("I parçasının döndürmesi dikey çizgi üretir", () => {
    const vertical = shapeOf("I", 1);
    // 4x4 matriste dikey çizgi: her satırda tam bir dolu hücre
    for (const row of vertical) {
      expect(row.filter((v) => v === 1).length).toBe(1);
    }
    expect(vertical.flat().filter((v) => v === 1).length).toBe(4);
  });

  it("T parçasının 4 döndürmesi birbirinden farklı şekillerdir", () => {
    const shapes = [0, 1, 2, 3].map((r) => JSON.stringify(shapeOf("T", r)));
    expect(new Set(shapes).size).toBe(4);
  });

  it("rotateMatrixCW köşeleri doğru taşır", () => {
    const matrix = [
      [1, 0],
      [0, 0],
    ];
    const rotated = rotateMatrixCW(matrix);
    expect(rotated[0][1]).toBe(1);
    expect(rotated[0][0]).toBe(0);
  });
});
