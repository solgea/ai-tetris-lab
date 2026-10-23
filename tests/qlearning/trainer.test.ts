import { describe, expect, it } from "vitest";
import { QAgent } from "../../src/qlearning/qagent";
import { Trainer, playEvalGame } from "../../src/qlearning/trainer";
import type { EpisodeRecord, TrainerOptions } from "../../src/qlearning/trainer";

const BASE_OPTIONS: TrainerOptions = {
  episodes: 2,
  seed: 12345,
  alpha: 0.2,
  gamma: 0.9,
  epsilon: 0.3,
  stepLimit: 25,
};

describe("eğitmen", () => {
  it("aynı tohumla eğitim tekrarlanabilirdir", async () => {
    const agentA = new QAgent();
    const agentB = new QAgent();
    const trainerA = new Trainer();
    const trainerB = new Trainer();
    const resultA = await trainerA.run(BASE_OPTIONS, agentA, {
      onEpisode: () => {},
    });
    const resultB = await trainerB.run(BASE_OPTIONS, agentB, {
      onEpisode: () => {},
    });
    expect(resultA.episodes.map((e) => e.score)).toEqual(
      resultB.episodes.map((e) => e.score),
    );
    expect(resultA.episodes.map((e) => e.lines)).toEqual(
      resultB.episodes.map((e) => e.lines),
    );
    expect(resultA.episodes.map((e) => e.pieces)).toEqual(
      resultB.episodes.map((e) => e.pieces),
    );
    expect(agentA.pairCount).toBe(agentB.pairCount);
  });

  it("eğitim istek üzerine durur ve kısmi sonuç 'stopped' işaretlenir", async () => {
    const agent = new QAgent();
    const trainer = new Trainer();
    const result = await trainer.run(
      { ...BASE_OPTIONS, episodes: 5 },
      agent,
      {
        onEpisode: (record: EpisodeRecord) => {
          if (record.index >= 1) trainer.cancelled = true;
        },
      },
    );
    expect(result.stopped).toBe(true);
    expect(result.episodes.length).toBe(2);
  });

  it("durdurulan eğitim aynı ajanla devam ettirilebilir", async () => {
    const agent = new QAgent();
    const trainer = new Trainer();
    const first = await trainer.run(
      { ...BASE_OPTIONS, episodes: 2 },
      agent,
      { onEpisode: () => {} },
    );
    expect(first.stopped).toBe(false);
    const trainedBefore = agent.episodesTrained;
    const second = await trainer.run(
      { ...BASE_OPTIONS, episodes: 2 },
      agent,
      { onEpisode: () => {} },
    );
    expect(second.episodes.length).toBe(2);
    expect(agent.episodesTrained).toBe(trainedBefore + 2);
  });

  it("eğitim Q tablosunu büyütür (öğrenme gerçekten gerçekleşir)", async () => {
    const agent = new QAgent();
    const trainer = new Trainer();
    await trainer.run(
      { ...BASE_OPTIONS, episodes: 3, stepLimit: 40 },
      agent,
      { onEpisode: () => {} },
    );
    expect(agent.stateCount).toBeGreaterThan(0);
    expect(agent.pairCount).toBeGreaterThan(0);
    expect(agent.totalSteps).toBeGreaterThan(0);
  });
});

describe("değerlendirme modu", () => {
  it("aynı tohumla değerlendirme oyunu aynı sonucu verir", () => {
    const agent = new QAgent();
    // Q tablosuna deterministik değerler yerleştir
    agent.update("dummy", "d", 1, null, []);
    const a = playEvalGame(agent, 4242, 20);
    const b = playEvalGame(agent, 4242, 20);
    expect(a.score).toBe(b.score);
    expect(a.pieces).toBe(b.pieces);
    expect(a.lines).toBe(b.lines);
  });

  it("değerlendirme oyunu Q tablosunu değiştirmez", () => {
    const agent = new QAgent();
    agent.update("dummy", "d", 1, null, []);
    const pairsBefore = agent.pairCount;
    const stepsBefore = agent.totalSteps;
    playEvalGame(agent, 77, 15);
    expect(agent.pairCount).toBe(pairsBefore);
    expect(agent.totalSteps).toBe(stepsBefore);
  });
});
