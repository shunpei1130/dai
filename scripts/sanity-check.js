import { createInitialState, reduceGame } from '../src/index.js';

let state = createInitialState('room-san');
state = reduceGame(state, { type: 'join', playerId: 'p1', name: 'Alice' });
state = reduceGame(state, { type: 'join', playerId: 'p2', name: 'Bob' });
state = reduceGame(state, { type: 'ready', playerId: 'p1' });
state = reduceGame(state, { type: 'ready', playerId: 'p2' });
state = reduceGame(state, { type: 'startGame', playerId: 'p1' });

if (state.phase !== 'playing') {
  throw new Error('Failed to reach playing phase in sanity check');
}

console.log('Sanity check finished with phase:', state.phase);
