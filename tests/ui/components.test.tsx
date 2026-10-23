import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBanner } from "../../src/ui/components/ErrorBanner";
import { DecisionPanel } from "../../src/ui/components/DecisionPanel";
import { TrainingPanel } from "../../src/ui/components/TrainingPanel";
import { ExperimentsPanel } from "../../src/ui/components/ExperimentsPanel";
import type { DecisionRecord } from "../../src/agent/types";

describe("ErrorBanner — hata durumlarının görünür olması", () => {
  it("hata yoksa hiçbir şey göstermez", () => {
    render(<ErrorBanner errors={[]} onDismiss={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hata mesajı görünür olur ve kapatılabilir", () => {
    render(
      <ErrorBanner
        errors={[{ id: 1, message: "test hatası" }]}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("test hatası");
    fireEvent.click(screen.getByLabelText("Hatayı kapat: test hatası"));
  });
});

describe("DecisionPanel — eksik veri durumları", () => {
  it("kayıt yoksa 'veri yok' gösterir", () => {
    render(<DecisionPanel record={null} selectedRecordId={null} />);
    expect(screen.getByTestId("decision-empty").textContent).toContain(
      "veri yok",
    );
  });

  it("uygulanmamış kayıtta doğrulama rozeti 'uygulanmadı' der", () => {
    const record = minimalRecord();
    render(<DecisionPanel record={record} selectedRecordId={record.id} />);
    expect(screen.getByText("uygulanmadı")).toBeDefined();
  });

  it("doğrulama uyuşmazlığı görünür kılınır", () => {
    const record: DecisionRecord = {
      ...minimalRecord(),
      applied: true,
      verification: {
        ok: false,
        expectedBoard: "x",
        actualBoard: "y",
        expectedLines: 1,
        actualLines: 0,
        error: "tahta parmak izi simülasyonla uyuşmuyor",
      },
      linesAfter: 0,
      scoreAfter: 0,
    };
    render(<DecisionPanel record={record} selectedRecordId={record.id} />);
    expect(screen.getByTestId("verification-fail").textContent).toContain(
      "UYUŞMAZLIK",
    );
  });

  it("aday tablosunda ulaşılamaz adaylar için 'veri yok' yazılır", () => {
    const record: DecisionRecord = {
      ...minimalRecord(),
      applied: true,
      verification: {
        ok: true,
        expectedBoard: "x",
        actualBoard: "x",
        expectedLines: 0,
        actualLines: 0,
      },
      linesAfter: 0,
      scoreAfter: 0,
    };
    render(<DecisionPanel record={record} selectedRecordId={record.id} />);
    const table = screen.getByTestId("candidate-table");
    expect(table.textContent).toContain("veri yok");
  });
});

describe("TrainingPanel — eksik veri durumları", () => {
  const baseState = {
    running: false,
    stopped: false,
    completedEpisodes: 0,
    targetEpisodes: 0,
    episodes: [],
    startedAt: null,
    finishedAt: null,
    options: null,
  };
  const qInfo = {
    stateCount: 0,
    pairCount: 0,
    alpha: 0.2,
    gamma: 0.9,
    epsilon: 0.15,
    episodesTrained: 0,
  };

  it("eğitim verisi yoksa 'veri yok' gösterir", () => {
    render(
      <TrainingPanel
        state={baseState}
        qInfo={qInfo}
        onStart={() => {}}
        onStop={() => {}}
        onSave={() => {}}
        onLoad={() => {}}
        loadError={null}
      />,
    );
    expect(screen.getByTestId("training-progress-empty").textContent).toContain(
      "veri yok",
    );
  });

  it("model yükleme hatası kullanıcıya görünür olur", () => {
    render(
      <TrainingPanel
        state={baseState}
        qInfo={qInfo}
        onStart={() => {}}
        onStop={() => {}}
        onSave={() => {}}
        onLoad={() => {}}
        loadError="QTable doğrulama hatası: desteklenmeyen sürüm"
      />,
    );
    expect(screen.getByTestId("q-load-error").textContent).toContain(
      "desteklenmeyen sürüm",
    );
  });
});

describe("ExperimentsPanel — eksik veri durumları", () => {
  it("deney yoksa 'veri yok' gösterir", () => {
    render(
      <ExperimentsPanel
        records={[]}
        running={false}
        onRun={() => {}}
        onStop={() => {}}
        hasQTable={false}
      />,
    );
    expect(screen.getByTestId("experiments-empty").textContent).toContain(
      "veri yok",
    );
  });

  it("yarım kalmış deney 'DURDURULDU' etiketiyle işaretlenir", () => {
    render(
      <ExperimentsPanel
        records={[
          {
            config: {
              id: "e1",
              name: "yarım",
              agentKind: "rule",
              games: 10,
              baseSeed: 1,
              stepLimit: 20,
              qEpisodesTrained: null,
              appVersion: "0.1.0",
            },
            results: [],
            status: "stopped",
            errorMessage: null,
            startedAt: 1,
            finishedAt: 2,
            verificationErrors: 0,
            summary: null,
          },
        ]}
        running={false}
        onRun={() => {}}
        onStop={() => {}}
        hasQTable={false}
      />,
    );
    expect(screen.getByText("DURDURULDU (kısmi)")).toBeDefined();
  });
});

function minimalRecord(): DecisionRecord {
  return {
    id: 1,
    pieceIndex: 1,
    pieceType: "T",
    createdAt: 0,
    weights: {
      linesCleared: 0.76,
      holes: -0.356,
      aggregateHeight: -0.51,
      maxHeight: -0.15,
      bumpiness: -0.184,
    },
    candidates: [
      {
        id: "0:3",
        rotation: 0,
        column: 3,
        plan: ["hardDrop"],
        reachable: false,
        landingY: null,
        metrics: null,
        contributions: null,
        score: null,
        simulatedBoard: null,
        reason: "kayma yolu kapalı",
      },
    ],
    selectedId: null,
    reasoning: "test gerekçesi",
    verification: null,
    applied: false,
    linesAfter: null,
    scoreAfter: null,
    mode: "agent",
  };
}
