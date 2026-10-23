import { useState } from "react";
import type { MetricName } from "../../agent/types";
import type { DecisionRecord, Candidate } from "../../agent/types";

/** Açıklanabilir karar paneli: aday sıralaması, puan bileşenleri, gerekçe. */
export function DecisionPanel({
  record,
  selectedRecordId,
}: {
  record: DecisionRecord | null;
  selectedRecordId: number | null;
}) {
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(
    null,
  );
  if (record === null) {
    return (
      <div className="panel" data-testid="decision-panel">
        <h2>Karar Paneli</h2>
        <p className="no-data" data-testid="decision-empty">
          veri yok — henüz ajan kararı alınmadı
        </p>
      </div>
    );
  }
  const expandedCandidate =
    record.candidates.find(
      (c) => c.id === (expandedCandidateId ?? record.selectedId),
    ) ?? null;
  return (
    <div className="panel" data-testid="decision-panel">
      <h2>
        Karar Paneli — #{record.id} {record.pieceType} parçası
        {selectedRecordId === record.id ? "" : " (geçmiş kaydı)"}
      </h2>
      <VerificationBadge record={record} />
      <div className="reasoning" data-testid="reasoning">
        {record.reasoning}
      </div>
      <CandidateTable
        candidates={record.candidates}
        selectedId={expandedCandidateId ?? record.selectedId}
        onSelect={setExpandedCandidateId}
      />
      <CandidateDetail
        candidate={expandedCandidate}
        weights={record.weights}
      />
    </div>
  );
}

export function VerificationBadge({ record }: { record: DecisionRecord }) {
  if (!record.applied) {
    return <span className="badge pending">uygulanmadı</span>;
  }
  if (record.verification === null) {
    return <span className="badge pending">doğrulama verisi yok</span>;
  }
  return record.verification.ok ? (
    <span className="badge ok" data-testid="verification-ok">
      ✓ simülasyon = motor sonucu
    </span>
  ) : (
    <span className="badge fail" data-testid="verification-fail">
      ✗ UYUŞMAZLIK: {record.verification.error ?? "bilinmeyen"}
    </span>
  );
}

function CandidateTable({
  candidates,
  selectedId,
  onSelect,
}: {
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <table className="data" data-testid="candidate-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Döndürme</th>
          <th>Sütun</th>
          <th>Satır</th>
          <th>Delik</th>
          <th>Top. yükseklik</th>
          <th>Tepe</th>
          <th>Düzensizlik</th>
          <th>Puan</th>
          <th>Gerekçe</th>
        </tr>
      </thead>
      <tbody>
        {candidates.slice(0, 12).map((candidate, index) => (
          <tr
            key={candidate.id}
            className={`clickable ${candidate.id === selectedId ? "selected" : ""}`}
            onClick={() => onSelect(candidate.id)}
          >
            <td>{index + 1}</td>
            <td>{candidate.rotation}</td>
            <td>{candidate.column}</td>
            <td>{candidate.metrics ? candidate.metrics.linesCleared : noData()}</td>
            <td>{candidate.metrics ? candidate.metrics.holes : noData()}</td>
            <td>{candidate.metrics ? candidate.metrics.aggregateHeight : noData()}</td>
            <td>{candidate.metrics ? candidate.metrics.maxHeight : noData()}</td>
            <td>{candidate.metrics ? candidate.metrics.bumpiness : noData()}</td>
            <td>{candidate.score !== null ? candidate.score.toFixed(3) : noData()}</td>
            <td className="muted">{candidate.reason || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const METRIC_LABELS: Record<MetricName, string> = {
  linesCleared: "temizlenen satır",
  holes: "delik",
  aggregateHeight: "toplam yükseklik",
  maxHeight: "tepe yükseklik",
  bumpiness: "yüzey düzensizliği",
};

/** Seçili adayın puan bileşenleri ve simüle tahta önizlemesi. */
export function CandidateDetail({
  candidate,
  weights,
}: {
  candidate: Candidate | null;
  weights: DecisionRecord["weights"];
}) {
  if (candidate === null || candidate.metrics === null || candidate.contributions === null) {
    return (
      <p className="no-data" data-testid="candidate-detail-empty">
        veri yok — incelemek için bir aday seçin
      </p>
    );
  }
  const maxAbs = Math.max(
    ...Object.values(candidate.contributions).map((v) => Math.abs(v ?? 0)),
    0.0001,
  );
  return (
    <div data-testid="candidate-detail">
      <h3>
        Aday detayı — rotation={candidate.rotation}, column={candidate.column},{" "}
        iniş satırı={candidate.landingY ?? "veri yok"}
      </h3>
      <table className="data">
        <thead>
          <tr>
            <th>Ölçüt</th>
            <th>Değer (birim)</th>
            <th>Ağırlık</th>
            <th>Katkı (puan)</th>
            <th>Payı</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(METRIC_LABELS) as MetricName[]).map((name) => {
            const value = candidate.metrics?.[name];
            const contribution = candidate.contributions?.[name];
            const ratio = Math.abs(contribution ?? 0) / maxAbs;
            return (
              <tr key={name}>
                <td>{METRIC_LABELS[name]}</td>
                <td>
                  {value === undefined ? noData() : `${value} ${metricUnit(name)}`}
                </td>
                <td>{weights[name]}</td>
                <td>
                  {contribution === undefined
                    ? noData()
                    : contribution.toFixed(3)}
                </td>
                <td>
                  <div className="contrib-bar">
                    <div
                      className={`contrib-fill ${(contribution ?? 0) < 0 ? "negative" : ""}`}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Toplam puan:{" "}
        <strong data-testid="candidate-score">
          {candidate.score !== null ? candidate.score.toFixed(3) : noData()}
        </strong>
      </p>
      {candidate.simulatedBoard !== null && (
        <div>
          <h3>Simüle edilmiş tahta (temizleme sonrası)</h3>
          <MiniBoardLite board={candidate.simulatedBoard} />
        </div>
      )}
    </div>
  );
}

function MiniBoardLite({ board }: { board: import("../../engine").Board }) {
  return (
    <div
      className="mini-board"
      style={{ gridTemplateColumns: `repeat(${board[0].length}, 10px)` }}
    >
      {board.flatMap((row, r) =>
        row.map((cell, c) => (
          <div key={`${r}:${c}`} className={`mc ${cell ?? ""}`} />
        )),
      )}
    </div>
  );
}

function metricUnit(name: MetricName): string {
  return name === "linesCleared" ? "satır" : "adet";
}

function noData(): string {
  return "veri yok";
}
