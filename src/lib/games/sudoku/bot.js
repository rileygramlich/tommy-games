// Sudoku bot. Only ever needed if someone marks the single seat as a bot.
// It works the grid out from the numbers that were dealt with it — never from
// anything already written in — so it can also correct a square that is wrong.
const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

const PEERS = Array.from({ length: 81 }, (_, i) => {
  const out = [];
  for (let j = 0; j < 81; j++) {
    if (j === i) continue;
    if (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)) out.push(j);
  }
  return out;
});

function fits(grid, i, value) {
  for (const j of PEERS[i]) if (grid[j] === value) return false;
  return true;
}

/** Backtracking solve, always taking the most constrained square first. */
function solve(grid) {
  let target = -1;
  let candidates = null;

  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const options = [];
    for (let v = 1; v <= 9; v++) if (fits(grid, i, v)) options.push(v);
    if (!options.length) return false;
    if (!candidates || options.length < candidates.length) {
      target = i;
      candidates = options;
      if (options.length === 1) break;
    }
  }

  if (target === -1) return true; // nothing empty: solved
  for (const value of candidates) {
    grid[target] = value;
    if (solve(grid)) return true;
    grid[target] = 0;
  }
  return false;
}

export function chooseMove(v) {
  const grid = new Array(81).fill(0);
  for (const cell of v.cells) if (cell.given) grid[cell.index] = cell.value;

  if (!solve(grid)) {
    // Should not happen: every grid this engine deals has one solution.
    const empty = v.cells.find((c) => !c.value && !c.given);
    return { type: 'place', index: empty?.index ?? 0, value: 1 };
  }

  // The first square that is empty, or holding something that cannot be right.
  const wrong = v.cells.find((cell) => !cell.given && cell.value !== grid[cell.index]);
  if (!wrong) return { type: 'place', index: 0, value: grid[0] };
  return { type: 'place', index: wrong.index, value: grid[wrong.index] };
}
