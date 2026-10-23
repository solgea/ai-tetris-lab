import { useRef } from "react";
import type { EpisodeRecord, TrainerOptions } from "../../qlearning/trainer";

export interface TrainingState {
  running: boolean;
  stopped: boolean;
  completedEpisodes: number;
  targetEpisodes: number;
  episodes: EpisodeRecord[];
  startedAt: number | null;
  finishedAt: number | null;
  options: TrainerOptions | null;
}

/**
 * Q-learning eğitim paneli. Eğitim kullanıcı tarafından başlatılır ve
 * durdurulabilir; arayüzü kilitlemez (async döngü).
 */
export function TrainingPanel({
  state,
  qInfo,
  onStart,
  onStop,
  onSave,
  onLoad,
  loadError,
}: {
  state: TrainingState;
  qInfo: { stateCount: number; pairCount: number; alpha: number; gamma: number; epsilon: number; episodesTrained: number };
  onStart: (options: TrainerOptions) => void;
  onStop: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  loadError: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const last10 = state.episodes.slice(-10);
  const avgLast10 =
    last10.length > 0
      ? last10.reduce((a, e) => a + e.score, 0) / last10.length
      : null;
  const rewards = state.episodes.map((e) => e.score);

  return (
    <div className="panel" data-testid="training-panel">
      <h2>Q-learning Eğitimi</h2>
      <p className="muted">
        Ödül = satır×50 (+tetris 200) − delik artışı×12 − tepe artışı×2 −
        oyun sonu 200. Eğitim motoru kurallarını değiştirmez.
      </p>
      <div className="form-grid">
        <label>
          Bölüm sayısı
          <input
            type="number"
            min={1}
            max={5000}
            defaultValue={100}
            id="train-episodes"
            disabled={state.running}
          />
        </label>
        <label>
          Tohum (seed)
          <input type="number" defaultValue={12345} id="train-seed" disabled={state.running} />
        </label>
        <label>
          Öğrenme oranı (α)
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="1"
            defaultValue={0.2}
            id="train-alpha"
            disabled={state.running}
          />
        </label>
        <label>
          İndirim çarpanı (γ)
          <input
            type="number"
            step="0.05"
            min="0.05"
            max="0.99"
            defaultValue={0.9}
            id="train-gamma"
            disabled={state.running}
          />
        </label>
        <label>
          Keşif (ε)
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            defaultValue={0.15}
            id="train-epsilon"
            disabled={state.running}
          />
        </label>
        <label>
          Parça sınırı / bölüm
          <input
            type="number"
            min={10}
            max={2000}
            defaultValue={300}
            id="train-steplimit"
            disabled={state.running}
          />
        </label>
      </div>
      <div className="controls-row">
        <button
          className="primary"
          type="button"
          data-testid="train-start"
          disabled={state.running}
          onClick={() =>
            onStart({
              episodes: numberValue("train-episodes", 100),
              seed: numberValue("train-seed", 12345),
              alpha: numberValue("train-alpha", 0.2),
              gamma: numberValue("train-gamma", 0.9),
              epsilon: numberValue("train-epsilon", 0.15),
              stepLimit: numberValue("train-steplimit", 300),
            })
          }
        >
          Eğitimi Başlat
        </button>
        <button
          className="danger"
          type="button"
          data-testid="train-stop"
          disabled={!state.running}
          onClick={onStop}
        >
          Durdur
        </button>
        <button type="button" onClick={onSave} data-testid="q-save">
          Q Tablosunu Kaydet
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="q-load"
        >
          Q Tablosu Yükle
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) onLoad(file);
            event.target.value = "";
          }}
        />
      </div>
      {loadError !== null && (
        <p className="error-banner" data-testid="q-load-error" role="alert">
          {loadError}
        </p>
      )}
      <h3>Q tablosu durumu (gerçek sayaçlar)</h3>
      <table className="data">
        <tbody>
          <tr>
            <td>Ziyaret edilen durum sayısı</td>
            <td data-testid="q-states">{qInfo.stateCount}</td>
          </tr>
          <tr>
            <td>Durum-eylem çifti sayısı</td>
            <td data-testid="q-pairs">{qInfo.pairCount}</td>
          </tr>
          <tr>
            <td>Tamamlanan eğitim bölümü</td>
            <td data-testid="q-episodes">{qInfo.episodesTrained}</td>
          </tr>
        </tbody>
      </table>
      <h3>Eğitim ilerlemesi</h3>
      {state.episodes.length === 0 ? (
        <p className="no-data" data-testid="training-progress-empty">
          veri yok — eğitim henüz başlatılmadı
        </p>
      ) : (
        <>
          <p>
            {state.completedEpisodes}/{state.targetEpisodes} bölüm tamamlandı
            {state.stopped && state.completedEpisodes < state.targetEpisodes
              ? " — DURDURULDU (kısmi veri)"
              : ""}
            {state.running ? " — çalışıyor…" : ""}
          </p>
          <p data-testid="train-avg">
            Son 10 bölüm ortalama skoru:{" "}
            <strong>{avgLast10 !== null ? avgLast10.toFixed(1) : "veri yok"}</strong>
          </p>
          <ScoreBars values={rewards} />
        </>
      )}
      {state.episodes.length > 0 && (
        <div className="scroll-list" style={{ marginTop: 8 }}>
          <table className="data" data-testid="episode-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Seed</th>
                <th>Skor</th>
                <th>Satır</th>
                <th>Parça</th>
                <th>Süre (ms)</th>
                <th>Bitiş</th>
              </tr>
            </thead>
            <tbody>
              {[...state.episodes].reverse().slice(0, 30).map((episode) => (
                <tr key={episode.index}>
                  <td>{episode.index + 1}</td>
                  <td>{episode.seed}</td>
                  <td>{episode.score}</td>
                  <td>{episode.lines}</td>
                  <td>{episode.pieces}</td>
                  <td>{episode.durationMs}</td>
                  <td>{episode.ended === "gameOver" ? "oyun sonu" : "sınır"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Kayıtlı ölçümlerden CSS çubuk grafiği — örnek veri KULLANILMAZ. */
export function ScoreBars({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <p className="no-data">veri yok</p>;
  }
  const max = Math.max(...values, 1);
  return (
    <div data-testid="score-bars" aria-label="Bölüm skor grafiği">
      {values.map((value, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="muted" style={{ width: 36 }}>
            {index + 1}
          </span>
          <div className="hist-bar" style={{ width: `${(value / max) * 80}%` }} />
          <span className="muted">{value}</span>
        </div>
      ))}
    </div>
  );
}

function numberValue(id: string, fallback: number): number {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (element === null) return fallback;
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}
