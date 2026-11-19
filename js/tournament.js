const ROUND_NAMES = {
  64: "64강",
  32: "32강",
  16: "16강",
  8: "8강",
  4: "4강",
  2: "결승",
};

export function roundName(count) {
  return ROUND_NAMES[count] || `${count}강`;
}

export function bracketSize(available, requested) {
  let size = Math.min(available, requested);
  let power = 1;
  while (power * 2 <= size) power *= 2;
  return power >= 2 ? power : 0;
}

export function shuffle(list, rng = Math.random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

export function startBracket(roster, size, rng = Math.random) {
  const count = bracketSize(roster.length, size);
  if (count < 2) return null;
  return {
    queue: shuffle(roster, rng).slice(0, count),
    next: [],
    round: roundName(count),
    over: false,
    winner: null,
  };
}

export function currentPair(state) {
  return state.queue.slice(0, 2);
}

export function matchProgress(state) {
  const remaining = state.queue.length / 2;
  const done = state.next.length;
  const total = done + remaining;
  return {
    current: done + 1,
    total,
    round: state.round,
  };
}

export function choose(state, winner, rng = Math.random) {
  const pair = state.queue.slice(0, 2);
  const chosen = pair.find((heroine) => heroine.id === winner.id);
  if (!chosen || pair.length < 2) throw new Error("pair");
  const queue = state.queue.slice(2);
  const next = state.next.concat(chosen);
  if (queue.length >= 2) {
    return { state: { ...state, queue, next, over: false, winner: null }, event: "next" };
  }
  if (next.length === 1) {
    return {
      state: { ...state, queue: [], next, over: true, winner: chosen },
      event: "done",
    };
  }
  return {
    state: {
      queue: shuffle(next, rng),
      next: [],
      round: roundName(next.length),
      over: false,
      winner: null,
    },
    event: "round",
  };
}
