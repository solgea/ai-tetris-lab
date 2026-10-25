import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyMove, boardFingerprint, createGame, hardDrop, pieceCells, tick } from "../engine";
import type { GameState, Move } from "../engine";
import { decide, executePlan, verifyExecution } from "../agent";
import type { AgentDecision } from "../agent/ruleAgent";
import type { DecisionRecord } from "../agent/types";
import { appendCapped, updateRecord } from "../agent/decisionLog";
import type { ExecutionResult } from "../agent/runner";
import { QAgent } from "../qlearning/qagent";
import { Trainer } from "../qlearning/trainer";
import type { EpisodeRecord, TrainerOptions } from "../qlearning/trainer";
import { APP_VERSION, runExperiment } from "../lab/experiments";
import type { AgentKind, ExperimentRecord } from "../lab/experiments";
import { BoardView } from "./components/BoardView";
import { NextQueue } from "./components/NextQueue";
import { ErrorBanner } from "./components/ErrorBanner";
import type { AppError } from "./components/ErrorBanner";
import { DecisionPanel } from "./components/DecisionPanel";
import { DecisionHistoryList } from "./components/DecisionHistory";
import { TrainingPanel } from "./components/TrainingPanel";
import type { TrainingState } from "./components/TrainingPanel";
import { ExperimentsPanel } from "./components/ExperimentsPanel";

const HISTORY_CAP = 200;
/** AI modunda adımlar arası bekleme (ms) — hamleler görünür adım adım uygulanır */
const AI_TICK_MS = 90;

type Tab = "decisions" | "training" | "experiments";

const EMPTY_TRAINING: TrainingState = {
  running: false,
  stopped: false,
  completedEpisodes: 0,
  targetEpisodes: 0,
  episodes: [],
  startedAt: null,
  finishedAt: null,
  options: null,
};

/** Devam eden ajan kararı: plan uygulanırken doğrulama için saklanır. */
interface PendingDecision {
  decision: AgentDecision;
  linesBefore: number;
}

export function App() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [running, setRunning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [history, setHistory] = useState<DecisionRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [lastDecision, setLastDecision] = useState<DecisionRecord | null>(null);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [tab, setTab] = useState<Tab>("decisions");
  const [training, setTraining] = useState<TrainingState>(EMPTY_TRAINING);
  const [qInfo, setQInfo] = useState({
    stateCount: 0,
    pairCount: 0,
    alpha: 0.2,
    gamma: 0.9,
    epsilon: 0.15,
    episodesTrained: 0,
  });
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [experimentRunning, setExperimentRunning] = useState(false);
  const [qLoadError, setQLoadError] = useState<string | null>(null);

  const gameRef = useRef(game);

  /**
   * D2 düzeltmesi — tek serileştirilmiş yazım kapısı.
   * TÜM oyun durumu yazımları (AI tick'i, Tek Hamle, klavye, yerçekimi,
   * yeniden başlatma) bu fonksiyondan geçer: gameRef senkron güncellenir,
   * React state yalnızca render aynasıdır. Böylece render ile effect arasındaki
   * gecikmeden kaynaklanan bayat-okuma yarışı ortadan kalkar; iki yazım
   * asla birbirinin üzerine yazamaz (JS tek iş parçacığında sıralanır).
   */
  const commitGame = useCallback(
    (transform: (prev: GameState) => GameState): GameState => {
      const next = transform(gameRef.current);
      if (next !== gameRef.current) {
        gameRef.current = next;
        setGame(next);
      }
      return next;
    },
    [],
  );

  const pendingRef = useRef<PendingDecision | null>(null);
  const nextRecordIdRef = useRef(1);
  const qAgentRef = useRef<QAgent>(new QAgent());
  const trainerRef = useRef<Trainer>(new Trainer());
  const stopExperimentRef = useRef(false);

  const pushError = useCallback((message: string) => {
    setErrors((prev) => [...prev, { id: Date.now() + Math.random(), message }]);
  }, []);

  const dismissError = useCallback((id: number) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
  }, []);

  const refreshQInfo = useCallback(() => {
    const agent = qAgentRef.current;
    setQInfo({
      stateCount: agent.stateCount,
      pairCount: agent.pairCount,
      alpha: agent.alpha,
      gamma: agent.gamma,
      episodesTrained: agent.episodesTrained,
      epsilon: 0,
    });
  }, []);

  /**
   * Doğrulama + kayıt güncelleme: simülasyon bekleneni motorun gerçek
   * sonucuyla karşılaştırır. Uyuşmazlık varsa hata görünür kılınır;
   * ajan asla sessizce başarılı sayılmaz.
   */
  const finalizeDecision = useCallback(
    (
      pending: PendingDecision,
      result: Pick<ExecutionResult, "state" | "linesCleared" | "fingerprint" | "completed">,
    ) => {
      const decision = pending.decision;
      // Deney laboratuvarıyla paylaşılan tek doğrulama mantığı.
      const verification = verifyExecution({
        expectedBoardFingerprint: decision.expectedBoardFingerprint,
        expectedLines: decision.expectedLines,
        fingerprint: result.fingerprint,
        linesCleared: result.linesCleared,
        completed: result.completed,
        expectedOver: decision.expectedOver,
        actualOver: result.state.over,
      });
      const appliedRecord: DecisionRecord = {
        ...decision.record,
        applied: true,
        verification,
        linesAfter: result.linesCleared,
        scoreAfter: result.state.score,
      };
      setHistory((prev) => updateRecord(prev, appliedRecord.id, appliedRecord));
      setLastDecision(appliedRecord);
      if (!verification.ok) {
        pushError(
          `Ajan doğrulama hatası: simülasyon motor sonucuyla uyuşmadı. ${verification.error ?? ""}`,
        );
      }
    },
    [pushError],
  );

  /** Yeni ajan kararı: adayları değerlendirir, kaydı günlüğe ekler. */
  const startDecision = useCallback(
    (source: GameState): boolean => {
      let decision;
      try {
        decision = decide(source, { nextRecordId: nextRecordIdRef.current });
      } catch (error) {
        pushError(
          `Ajan karar veremedi: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      }
      nextRecordIdRef.current += 1;
      pendingRef.current = { decision, linesBefore: source.lines };
      setLastDecision(decision.record);
      setSelectedRecordId(decision.record.id);
      setHistory((prev) => appendCapped(prev, decision.record, HISTORY_CAP));
      return true;
    },
    [pushError],
  );

  /**
   * Yapay zekâ döngüsü: karar alındıktan sonra plan adım adım (döndürme,
   * kayma, sert düşüş) uygulanır; sert düşüşte simülasyon doğrulanır.
   */
  useEffect(() => {
    if (!running || !aiEnabled || game.over) return;
    const id = window.setInterval(() => {
      const current = gameRef.current;
      if (current.over) {
        setRunning(false);
        return;
      }
      const pending = pendingRef.current;
      if (pending === null) {
        startDecision(current);
        return;
      }
      const [move, ...rest] = pending.decision.plan;
      pending.decision.plan = rest;
      const next = commitGame((prev) => applyMove(prev, move));
      if (move === "hardDrop") {
        finalizeDecision(pending, {
          state: next,
          linesCleared: next.lines - pending.linesBefore,
          fingerprint: boardFingerprint(next.board),
          completed: true,
        });
        pendingRef.current = null;
      }
    }, AI_TICK_MS);
    return () => window.clearInterval(id);
  }, [running, aiEnabled, game.over, startDecision, finalizeDecision, commitGame]);

  /** İnsan modu yerçekimi döngüsü. */
  useEffect(() => {
    if (!running || aiEnabled || game.over) return;
    const speed = Math.max(90, 700 - (game.level - 1) * 60);
    const id = window.setInterval(() => {
      commitGame((prev) => (prev.over ? prev : tick(prev)));
    }, speed);
    return () => window.clearInterval(id);
  }, [running, aiEnabled, game.over, game.level, commitGame]);

  const restart = useCallback(() => {
    pendingRef.current = null;
    commitGame(() => createGame());
    setHistory([]);
    setLastDecision(null);
    setSelectedRecordId(null);
    nextRecordIdRef.current = 1;
  }, [commitGame]);

  /** Klavye kontrolleri (yalnızca insan modunda hamle için). */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target !== null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key in KEY_MAP && !aiEnabled) {
        event.preventDefault();
        const move = KEY_MAP[event.key];
        commitGame((prev) => applyMove(prev, move));
        return;
      }
      if (event.key === "p" || event.key === "P") {
        setRunning((prev) => !prev);
      } else if (event.key === "r" || event.key === "R") {
        restart();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aiEnabled, restart, commitGame]);

  /** Tek tam ajan hamlesi: karar + uygulama + doğrulama (duraklatmada da). */
  const handleStep = useCallback(() => {
    const current = gameRef.current;
    if (current.over) return;
    if (aiEnabled) {
      if (pendingRef.current === null && !startDecision(current)) return;
      const pending = pendingRef.current;
      if (pending === null) return;
      const result = executePlan(current, pending.decision.plan);
      pending.decision.plan = [];
      finalizeDecision(pending, result);
      pendingRef.current = null;
      commitGame(() => result.state);
    } else {
      commitGame((prev) => tick(prev));
    }
  }, [aiEnabled, startDecision, finalizeDecision, commitGame]);

  const handleHardDropManual = useCallback(() => {
    commitGame((prev) => hardDrop(prev));
  }, [commitGame]);

  const startTraining = useCallback(
    (options: TrainerOptions) => {
      setTraining({
        running: true,
        stopped: false,
        completedEpisodes: 0,
        targetEpisodes: options.episodes,
        episodes: [],
        startedAt: Date.now(),
        finishedAt: null,
        options,
      });
      trainerRef.current.cancelled = false;
      const trainer = trainerRef.current;
      const agent = qAgentRef.current;
      void trainer
        .run(options, agent, {
          onEpisode: (record: EpisodeRecord) => {
            setTraining((prev) => ({
              ...prev,
              completedEpisodes: prev.completedEpisodes + 1,
              episodes: [...prev.episodes, record],
            }));
            refreshQInfo();
          },
        })
        .then((result) => {
          setTraining((prev) => ({
            ...prev,
            running: false,
            stopped: result.stopped,
            finishedAt: Date.now(),
          }));
          refreshQInfo();
          if (result.stopped) {
            pushError("Eğitim kullanıcı tarafından durduruldu (kısmi veri).");
          }
        });
    },
    [pushError, refreshQInfo],
  );

  const stopTraining = useCallback(() => {
    trainerRef.current.cancelled = true;
  }, []);

  const saveQTable = useCallback(() => {
    const data = qAgentRef.current.toData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qtable-v${data.version}-ep${data.stats?.episodesTrained ?? 0}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const loadQTable = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (parseError) {
          setQLoadError(
            `Dosya geçerli JSON değil: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
          return;
        }
        const agent = QAgent.fromData(parsed);
        qAgentRef.current = agent;
        setQLoadError(null);
        refreshQInfo();
      } catch (error) {
        // Doğrulama hataları kullanıcıya görünür kılınır; asla yutulmaz.
        setQLoadError(error instanceof Error ? error.message : String(error));
      }
    },
    [refreshQInfo],
  );

  const startExperiment = useCallback(
    async (config: {
      name: string;
      agentKind: AgentKind;
      games: number;
      baseSeed: number;
      stepLimit: number;
    }) => {
      setExperimentRunning(true);
      stopExperimentRef.current = false;
      const record = await runExperiment({
        config: {
          id: `exp-${Date.now()}`,
          name: config.name,
          agentKind: config.agentKind,
          games: config.games,
          baseSeed: config.baseSeed,
          stepLimit: config.stepLimit,
          qEpisodesTrained:
            config.agentKind === "qlearn"
              ? qAgentRef.current.episodesTrained
              : null,
          appVersion: APP_VERSION,
        },
        qAgent: config.agentKind === "qlearn" ? qAgentRef.current : undefined,
        shouldStop: () => stopExperimentRef.current,
      });
      setExperiments((prev) => [...prev, record]);
      setExperimentRunning(false);
    },
    [],
  );

  const stopExperiment = useCallback(() => {
    stopExperimentRef.current = true;
  }, []);

  /** Devam eden/seçili adayın hedef hücreleri — tahtada görsel vurgu. */
  const targetCells = useMemo(() => {
    if (lastDecision === null || game.over) return null;
    if (lastDecision.pieceIndex !== game.pieces) return null;
    const candidate = lastDecision.candidates.find(
      (c) => c.id === lastDecision.selectedId,
    );
    if (
      candidate === undefined ||
      !candidate.reachable ||
      candidate.landingY === null
    ) {
      return null;
    }
    const cells = new Set<string>();
    for (const { x, y } of pieceCells({
      type: lastDecision.pieceType,
      rotation: candidate.rotation,
      x: candidate.column,
      y: candidate.landingY,
    })) {
      cells.add(`${y}:${x}`);
    }
    return cells;
  }, [game.pieces, game.over, lastDecision]);

  const selectedRecord =
    history.find((r) => r.id === selectedRecordId) ?? lastDecision;

  return (
    <div className="layout">
      <div className="game-column panel">
        <h1>AI Tetris Lab</h1>
        <div className="header-stats">
          <div>
            <div className="muted">Puan</div>
            <div className="stat-value" data-testid="score">
              {game.score}
            </div>
          </div>
          <div>
            <div className="muted">Satır</div>
            <div className="stat-value" data-testid="lines">
              {game.lines}
            </div>
          </div>
          <div>
            <div className="muted">Seviye</div>
            <div className="stat-value" data-testid="level">
              {game.level}
            </div>
          </div>
          <div>
            <div className="muted">Parça</div>
            <div className="stat-value" data-testid="pieces">
              {game.pieces}
            </div>
          </div>
          <div>
            <div className="muted">Seed</div>
            <div className="stat-value" data-testid="seed">
              {game.seed}
            </div>
          </div>
        </div>
        <ErrorBanner errors={errors} onDismiss={dismissError} />
        {game.over && (
          <div role="alert" data-testid="game-over" className="error-banner">
            <span>OYUN SONU — Yeniden Başlat'a basın</span>
          </div>
        )}
        <div className="board-frame">
          <BoardView state={game} targetCells={targetCells} />
          <NextQueue next={game.next} />
        </div>
        <div className="controls-row">
          <button
            className="primary"
            type="button"
            data-testid="start-pause"
            onClick={() => setRunning((prev) => !prev)}
            disabled={game.over}
          >
            {running ? "Duraklat" : "Başlat"}
          </button>
          <button type="button" data-testid="restart" onClick={restart}>
            Yeniden Başlat
          </button>
          <button
            type="button"
            data-testid="toggle-ai"
            onClick={() => {
              pendingRef.current = null;
              setAiEnabled((prev) => !prev);
            }}
          >
            Ajan: {aiEnabled ? "AÇIK" : "KAPALI"}
          </button>
          <button
            type="button"
            data-testid="step"
            onClick={handleStep}
            disabled={game.over || !aiEnabled}
            title="Tek ajan hamlesi ilerlet (karar + uygulama + doğrulama)"
          >
            Tek Hamle
          </button>
          <button
            type="button"
            data-testid="hard-drop"
            onClick={handleHardDropManual}
            disabled={game.over || aiEnabled}
          >
            Sert Düşür
          </button>
        </div>
        <p className="muted">
          Klavye: ← → hareket, ↑ / X döndür, Z ters döndür, ↓ yumuşak düşür,
          boşluk sert düşür, P duraklat, R yeniden başlat. Ajan açıkken hamle
          klavyesi devre dışıdır.
        </p>
      </div>

      <div className="side-column">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "decisions"}
            className={`tab ${tab === "decisions" ? "active" : ""}`}
            onClick={() => setTab("decisions")}
          >
            Kararlar
          </button>
          <button
            role="tab"
            aria-selected={tab === "training"}
            className={`tab ${tab === "training" ? "active" : ""}`}
            onClick={() => setTab("training")}
          >
            Eğitim
          </button>
          <button
            role="tab"
            aria-selected={tab === "experiments"}
            className={`tab ${tab === "experiments" ? "active" : ""}`}
            onClick={() => setTab("experiments")}
          >
            Deneyler
          </button>
        </div>
        {tab === "decisions" && (
          <>
            <DecisionPanel
              record={selectedRecord ?? null}
              selectedRecordId={selectedRecordId}
            />
            <DecisionHistoryList
              records={history}
              selectedRecordId={selectedRecordId}
              onSelect={setSelectedRecordId}
            />
          </>
        )}
        {tab === "training" && (
          <TrainingPanel
            state={training}
            qInfo={qInfo}
            onStart={startTraining}
            onStop={stopTraining}
            onSave={saveQTable}
            onLoad={(file) => void loadQTable(file)}
            loadError={qLoadError}
          />
        )}
        {tab === "experiments" && (
          <ExperimentsPanel
            records={experiments}
            running={experimentRunning}
            onRun={(config) => void startExperiment(config)}
            onStop={stopExperiment}
            hasQTable={qInfo.stateCount > 0}
          />
        )}
      </div>
    </div>
  );
}

const KEY_MAP: Record<string, Move> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "rotateCW",
  x: "rotateCW",
  X: "rotateCW",
  z: "rotateCCW",
  Z: "rotateCCW",
  ArrowDown: "softDrop",
  " ": "hardDrop",
};
