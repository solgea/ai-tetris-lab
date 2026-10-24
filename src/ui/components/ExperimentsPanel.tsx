import { useState } from "react";
import type { ExperimentRecord, AgentKind } from "../../lab/experiments";

/**
 * Deney ve karşılaştırma laboratuvarı paneli.
 * Tüm tablolar ve grafikler yalnızca kayıtlı ölçümlerden üretilir.
 */
export function ExperimentsPanel({
  records,
  running,
  onRun,
  onStop,
  hasQTable,
}: {
  records: ExperimentRecord[];
  running: boolean;
  onRun: (config: {
    name: string;
    agentKind: AgentKind;
    games: number;
    baseSeed: number;
    stepLimit: number;
  }) => void;
  onStop: () => void;
  hasQTable: boolean;
}) {
  const [showRecords, setShowRecords] = useState(true);
  return (
    <div className="panel" data-testid="experiments-panel">
      <h2>Deney ve Karşılaştırma</h2>
      <div className="form-grid">
        <label>
          Deney adı
          <input type="text" defaultValue="Deney" id="exp-name" disabled={running} />
        </label>
        <label>
          Ajan
          <select id="exp-agent" defaultValue="rule" disabled={running}>
            <option value="rule">Kural tabanlı</option>
            <option value="qlearn">Q-learning (keşifsiz)</option>
          </select>
        </label>
        <label>
          Oyun sayısı
          <input type="number" min={1} max={200} defaultValue={10} id="exp-games" disabled={running} />
        </label>
        <label>
          Temel tohum
          <input type="number" defaultValue={777} id="exp-seed" disabled={running} />
        </label>
        <label>
          Parça sınırı / oyun
          <input type="number" min={10} max={2000} defaultValue={200} id="exp-steplimit" disabled={running} />
        </label>
      </div>
      <div className="controls-row">
        <button
          className="primary"
          type="button"
          data-testid="exp-run"
          disabled={running}
          onClick={() =>
            onRun({
              name: textValue("exp-name", "Deney"),
              agentKind: (document.getElementById("exp-agent") as HTMLSelectElement)
                .value as AgentKind,
              games: numberValue("exp-games", 10),
              baseSeed: numberValue("exp-seed", 777),
              stepLimit: numberValue("exp-steplimit", 200),
            })
          }
        >
          Deneyi Başlat
        </button>
        <button className="danger" type="button" data-testid="exp-stop" disabled={!running} onClick={onStop}>
          Durdur
        </button>
        <button type="button" onClick={() => setShowRecords((v) => !v)}>
          {showRecords ? "Kayıtları gizle" : "Kayıtları göster"}
        </button>
      </div>
      {!hasQTable && (
        <p className="muted">
          Not: Q-learning ajanı deneyi için önce eğitim panelinde Q tablosu
          oluşturulmalı veya yüklenmelidir.
        </p>
      )}
      {records.length === 0 ? (
        <p className="no-data" data-testid="experiments-empty">
          veri yok — henüz tamamlanmış deney yok
        </p>
      ) : (
        showRecords && <ExperimentRecords records={records} />
      )}
    </div>
  );
}

function ExperimentRecords({ records }: { records: ExperimentRecord[] }) {
  return (
    <>
      <h3>Deney kayıtları</h3>
      <div className="scroll-list">
        <table className="data" data-testid="experiment-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Ajan</th>
              <th>Oyun</th>
              <th>Ort. skor</th>
              <th>Medyan</th>
              <th>Ort. satır</th>
              <th>Ort. süre (ms)</th>
              <th>Oyun sonu oranı</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const summary = record.summary;
              return (
                <tr key={record.config.id}>
                  <td>{record.config.name}</td>
                  <td>{record.config.agentKind === "rule" ? "kural" : "Q"}</td>
                  <td>
                    {summary ? summary.gameCount : 0}/{record.config.games}
                  </td>
                  <td>{summary ? summary.meanScore.toFixed(1) : "veri yok"}</td>
                  <td>{summary ? summary.medianScore.toFixed(1) : "veri yok"}</td>
                  <td>{summary ? summary.meanLines.toFixed(2) : "veri yok"}</td>
                  <td>{summary ? summary.meanDurationMs.toFixed(0) : "veri yok"}</td>
                  <td>{summary ? `${(summary.gameOverRate * 100).toFixed(0)}%` : "veri yok"}</td>
                  <td>
                    <StatusBadge record={record} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <LastExperimentDetail record={records[records.length - 1]} />
    </>
  );
}

function StatusBadge({ record }: { record: ExperimentRecord }) {
  const label =
    record.status === "completed"
      ? "tamamlandı"
      : record.status === "stopped"
        ? "DURDURULDU (kısmi)"
        : record.status === "completedWithErrors"
          ? `TAMAMLANDI — DOĞRULAMA HATALI (${record.verificationErrors})`
          : `HATA: ${record.errorMessage ?? "bilinmeyen"}`;
  const cls =
    record.status === "completed"
      ? "ok"
      : record.status === "stopped"
        ? "pending"
        : "fail";
  return <span className={`badge ${cls}`}>{label}</span>;
}

function LastExperimentDetail({ record }: { record: ExperimentRecord | null }) {
  if (record === null || record.summary === null) {
    return (
      <p className="no-data" data-testid="experiment-detail-empty">
        veri yok — deney sonucu henüz yok
      </p>
    );
  }
  const summary = record.summary;
  const maxCount = Math.max(...summary.lineDistribution.map((b) => b.count), 1);
  return (
    <div data-testid="experiment-detail">
      <h3>Son deney: {record.config.name} — satır dağılımı</h3>
      <p className="muted">
        Yazılım sürümü {record.config.appVersion}; temel tohum{" "}
        {record.config.baseSeed}; parça sınırı {record.config.stepLimit}.
        {record.config.qEpisodesTrained !== null &&
          ` Q tablosu eğitim bölümü: ${record.config.qEpisodesTrained}.`}
        {` Doğrulama: ${record.verificationsPerformed} hamle denetlendi, ${record.verificationErrors} uyuşmazlık.`}
        {record.verificationErrors > 0 &&
          ` DİKKAT: ${record.verificationErrors} simülasyon-motor uyuşmazlığı.`}
      </p>
      {summary.lineDistribution.map((bin) => (
        <div key={bin.lines} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="muted" style={{ width: 90 }}>
            {bin.lines} satır
          </span>
          <div className="hist-bar" style={{ width: `${(bin.count / maxCount) * 70}%` }} />
          <span className="muted">{bin.count} oyun</span>
        </div>
      ))}
      <p>
        Min skor {summary.minScore} — maks skor {summary.maxScore}; medyan satır{" "}
        {summary.medianLines.toFixed(2)}
      </p>
    </div>
  );
}

function numberValue(id: string, fallback: number): number {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (element === null) return fallback;
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function textValue(id: string, fallback: string): string {
  const element = document.getElementById(id) as HTMLInputElement | null;
  return element?.value ?? fallback;
}
