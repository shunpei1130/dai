import React, { useState } from 'react';
import { GameTable } from '@/components/game/GameTable';
import { Home } from '@/components/home/Home';
import { OnlineLobby } from '@/components/online/OnlineLobby';
import { RuleSettings } from '@/components/settings/RuleSettings';
import { type RuleConfig, DEFAULT_RULES } from '@/engine/Rules';

type Screen = 'home' | 'local_game' | 'online_lobby';

const RULES_STORAGE_KEY = 'daifugo-rules';

function loadRules(): RuleConfig {
  try {
    const data = localStorage.getItem(RULES_STORAGE_KEY);
    if (data) return { ...DEFAULT_RULES, ...JSON.parse(data) };
  } catch { /* ignore */ }
  return { ...DEFAULT_RULES };
}

function saveRules(rules: RuleConfig): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch { /* ignore */ }
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('home');
  const [rules, setRules] = useState<RuleConfig>(loadRules);
  const [showSettings, setShowSettings] = useState(false);

  const handleSaveRules = (newRules: RuleConfig) => {
    setRules(newRules);
    saveRules(newRules);
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen font-sans">
      {screen === 'home' && (
        <Home
          onStartLocal={() => setScreen('local_game')}
          onStartOnline={() => setScreen('online_lobby')}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}
      {screen === 'local_game' && (
        <GameTable
          rules={rules}
          onGoHome={() => setScreen('home')}
        />
      )}
      {screen === 'online_lobby' && (
        <OnlineLobby onGoHome={() => setScreen('home')} />
      )}

      {showSettings && (
        <RuleSettings
          rules={rules}
          onSave={handleSaveRules}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default App;
