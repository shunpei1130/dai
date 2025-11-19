# 大富豪ゲームエンジン

このリポジトリは大富豪（大貧民）サーバー向けの純粋関数ベースゲームエンジンを提供します。ゲームの進行は `state + command => newState` のリデューサーで表現され、クライアント側は入力と状態描画のみに集中できます。

## 主な特徴

- **完全な状態遷移**: `reduceGame(state, command)` が常に新しい `GameState` を返し、副作用を持ちません。
- **詳細なデータモデル**: プレイヤー、カード、ローカルルール、フェーズなど仕様書に沿った構造をすべて実装しています。
- **ルールプラグイン**: 8切り・11バック・革命・リバース・スキップなどを `RuleModule` として定義。追加のローカルルールもモジュールを1つ増やすだけです。
- **検証済みカードロジック**: ランク比較、役判定（シングル/複数/階段）、縛り判定、強さ比較などを共通のヘルパーに集約しました。
- **ログストリーム**: すべてのイベントはログに積まれ、クライアントへそのまま通知できます。

## 使い方

```js
import { createInitialState, reduceGame } from './src/index.js';

let state = createInitialState('room-1');
state = reduceGame(state, { type: 'join', playerId: 'p1', name: 'Alice' });
state = reduceGame(state, { type: 'join', playerId: 'p2', name: 'Bob' });
state = reduceGame(state, { type: 'ready', playerId: 'p1' });
state = reduceGame(state, { type: 'ready', playerId: 'p2' });
state = reduceGame(state, { type: 'startGame', playerId: 'p1' });
// state.phase === 'playing'
```

ゲーム中は `playCards`, `pass`, `nextRound` などのコマンドを `reduceGame` に送るだけで状態が更新されます。`state.logs` には `EventType` とメッセージが順次追加されるため、クライアントへの通知も容易です。

## ルールモジュール

`src/rules/modules` 以下でルールを登録します。各モジュールは `isEnabled`, `shouldTrigger`, `apply` を持ち、`applyTriggers` パイプラインで評価されます。現在は以下を実装済みです。

- 革命（通常/階段）
- 8切り、4止め（メッセージのみ）、11バック、9/12リバース
- 5スキップ、13スキップ

新しいローカルルールを追加したい場合は同じ構造のモジュールを1つ追加し、`RULE_MODULES` に登録してください。

## サニティチェック

依存パッケージが不要なため `npm install` は不要です。挙動確認には次のコマンドを実行します。

```bash
npm test
```

`scripts/sanity-check.js` が最低限のゲーム開始フローをシミュレートし、`playing` フェーズへ遷移できるかを確認します。
