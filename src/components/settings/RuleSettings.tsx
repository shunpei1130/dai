import React, { useState } from 'react';
import { type RuleConfig, DEFAULT_RULES, SIMPLE_RULES, ALL_RULES } from '@/engine/Rules';

interface RuleSettingsProps {
    rules: RuleConfig;
    onSave: (rules: RuleConfig) => void;
    onClose: () => void;
}

interface RuleToggleProps {
    label: string;
    labelJa: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    isNew?: boolean;
}

const RuleToggle: React.FC<RuleToggleProps> = ({ label, labelJa, description, checked, onChange, isNew }) => (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
        <div className="flex-1 mr-4">
            <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">{label}</span>
                <span className="text-yellow-400 text-xs font-bold">{labelJa}</span>
                {isNew && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/20 px-1.5 py-0.5 rounded-full">NEW</span>}
            </div>
            <p className="text-slate-400 text-xs mt-0.5">{description}</p>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-slate-600'
                }`}
        >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
        </button>
    </div>
);

export const RuleSettings: React.FC<RuleSettingsProps> = ({ rules, onSave, onClose }) => {
    const [localRules, setLocalRules] = useState<RuleConfig>({ ...rules });

    const updateRule = <K extends keyof RuleConfig>(key: K, value: RuleConfig[K]) => {
        setLocalRules(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <h2 className="text-xl font-black text-white">⚙️ ルール設定</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                {/* Presets */}
                <div className="flex gap-2 px-5 pt-4">
                    <button
                        onClick={() => setLocalRules({ ...DEFAULT_RULES })}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full transition-colors"
                    >
                        🎯 スタンダード
                    </button>
                    <button
                        onClick={() => setLocalRules({ ...SIMPLE_RULES })}
                        className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-full transition-colors"
                    >
                        📋 シンプル
                    </button>
                    <button
                        onClick={() => setLocalRules({ ...ALL_RULES })}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-full transition-colors"
                    >
                        🔥 全ルール
                    </button>
                </div>

                {/* Rules List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-2">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">基本ルール</h3>
                    <RuleToggle label="Revolution" labelJa="革命" description="4枚同数出しでカードの強さが逆転" checked={localRules.revolution} onChange={v => updateRule('revolution', v)} />
                    <RuleToggle label="8-Stop" labelJa="8切り" description="8を出すと場が流れ、次のリード権を得る" checked={localRules.eightStop} onChange={v => updateRule('eightStop', v)} />
                    <RuleToggle label="Sequence" labelJa="階段" description="同スートの3枚以上連続カードを出せる" checked={localRules.sequence} onChange={v => updateRule('sequence', v)} />
                    <RuleToggle label="Joker Wild" labelJa="ジョーカー" description="ジョーカーを任意のカード代わりに使用" checked={localRules.jokerWild} onChange={v => updateRule('jokerWild', v)} />

                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-2">特殊カード効果</h3>
                    <RuleToggle label="J-Back" labelJa="11バック" description="Jを出すと場が流れるまで強さが一時逆転" checked={localRules.elevenBack} onChange={v => updateRule('elevenBack', v)} />
                    <RuleToggle label="Spade-3 Return" labelJa="スペ3返し" description="単体ジョーカーに対してスペードの3で勝てる" checked={localRules.spadeThreeReturn} onChange={v => updateRule('spadeThreeReturn', v)} />
                    <RuleToggle label="5-Skip" labelJa="5飛ばし" description="5を出すと次のプレイヤーをスキップ" checked={localRules.fiveSkip} onChange={v => updateRule('fiveSkip', v)} />
                    <RuleToggle label="7-Pass" labelJa="7渡し" description="7を出すとカードを次のプレイヤーに渡せる" checked={localRules.sevenPass} onChange={v => updateRule('sevenPass', v)} />
                    <RuleToggle label="10-Discard" labelJa="10捨て" description="10を出すと手札から追加でカードを捨てられる" checked={localRules.tenDiscard} onChange={v => updateRule('tenDiscard', v)} />
                    <RuleToggle label="9-Reverse" labelJa="9リバース" description="9を出すとターン順序が逆転" checked={localRules.nineReverse} onChange={v => updateRule('nineReverse', v)} isNew />
                    <RuleToggle label="9-Reverse Persist" labelJa="9リバース永続" description="9リバースの効果が場流れ後も維持される(DQX式)" checked={localRules.nineReversePersist} onChange={v => updateRule('nineReversePersist', v)} isNew />

                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-2">縛りルール</h3>
                    <RuleToggle label="Suit Lock" labelJa="縛り" description="同スートが連続すると以降同スートのみ出せる" checked={localRules.suitLock} onChange={v => updateRule('suitLock', v)} />
                    <RuleToggle label="Super Lock" labelJa="激縛り" description="同スート+連続数字で完全縛り (♥4→♥5→♥6)" checked={localRules.superLock} onChange={v => updateRule('superLock', v)} isNew />
                    <RuleToggle label="Number Lock" labelJa="数しば" description="連続数字が続くと次も連続数字しか出せない" checked={localRules.numberLock} onChange={v => updateRule('numberLock', v)} isNew />
                    <RuleToggle label="Partial Lock" labelJa="片縛り" description="複数枚出しで一部スート一致でも縛りが発生" checked={localRules.partialLock} onChange={v => updateRule('partialLock', v)} isNew />

                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-2">特殊コンボ</h3>
                    <RuleToggle label="Sandstorm" labelJa="砂嵐(33返し)" description="3を3枚出すと全カードに勝てる(ジョーカー含む)" checked={localRules.sandstorm} onChange={v => updateRule('sandstorm', v)} isNew />
                    <RuleToggle label="Ambulance" labelJa="救急車(99車)" description="9を2枚出すと場が流れる(8切りの9版)" checked={localRules.ambulance} onChange={v => updateRule('ambulance', v)} isNew />
                    <RuleToggle label="Q-Bomber" labelJa="Qボンバー" description="Qを出すと宣言した数字を全員の手札から捨てさせる" checked={localRules.qBomber} onChange={v => updateRule('qBomber', v)} isNew />

                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-2">上がり制限</h3>
                    <RuleToggle label="Forbidden Finish" labelJa="禁止上がり" description="特殊カード(ジョーカー/2/8)での上がりを禁止" checked={localRules.forbiddenFinish} onChange={v => updateRule('forbiddenFinish', v)} />

                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-2">ラウンド間ルール</h3>
                    <RuleToggle label="Card Exchange" labelJa="カード交換" description="ラウンド間で大富豪⇔大貧民がカードを交換" checked={localRules.cardExchange} onChange={v => updateRule('cardExchange', v)} />
                    <RuleToggle label="Capital Fall" labelJa="都落ち" description="前回の大富豪が1位でなければ大貧民に降格" checked={localRules.capitalFall} onChange={v => updateRule('capitalFall', v)} />
                    <RuleToggle label="Sequence Revolution" labelJa="階段革命" description="5枚以上の階段で革命が発生" checked={localRules.sequenceRevolution} onChange={v => updateRule('sequenceRevolution', v)} />
                    <RuleToggle label="8-Stop Exclude Seq" labelJa="8切り階段除外" description="8を含む階段で8切りが発動しない(連盟公式)" checked={localRules.eightStopExcludeSequence} onChange={v => updateRule('eightStopExcludeSequence', v)} isNew />
                    <RuleToggle label="Leader Must Play" labelJa="親パス禁止" description="場が空のとき親はパスできない(DQX式)" checked={localRules.leaderMustPlay} onChange={v => updateRule('leaderMustPlay', v)} isNew />
                    <RuleToggle label="Gekokujo" labelJa="下剋上" description="大貧民が1位で上がると全員の階級が反転" checked={localRules.gekokujo} onChange={v => updateRule('gekokujo', v)} isNew />
                    <RuleToggle label="Cataclysm" labelJa="天変地異" description="大貧民の手札が全て10以下なら大富豪と手札交換" checked={localRules.cataclysm} onChange={v => updateRule('cataclysm', v)} isNew />

                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-2">デッキ設定</h3>
                    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/50">
                        <div>
                            <span className="text-white font-semibold text-sm">Joker Count</span>
                            <span className="text-yellow-400 text-xs font-bold ml-2">ジョーカー枚数</span>
                        </div>
                        <div className="flex gap-2">
                            {[0, 1, 2].map(n => (
                                <button
                                    key={n}
                                    onClick={() => updateRule('jokerCount', n)}
                                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${localRules.jokerCount === n
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={() => onSave(localRules)}
                        className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors"
                    >
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
};
