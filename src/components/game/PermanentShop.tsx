import { useGameStore } from '@/stores/gameStore';
import { PERMANENT_UPGRADES } from '@/game/constants';
import { useSoundClick } from '@/hooks/useSoundClick';

interface PermanentShopProps {
  onBack: () => void;
}

const PermanentShop = ({ onBack }: PermanentShopProps) => {
  const { totalCoins, purchasePermanentUpgrade, getUpgradeLevel, getUpgradeCost } = useGameStore();
  const handleBack = useSoundClick(onBack);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 animate-fade-in max-w-lg w-full px-4">
        <div className="text-center">
          <h2 className="text-3xl font-display font-bold text-foreground">UPGRADES SHOP</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-lg">🪙</span>
            <span className="text-xl font-display font-bold text-accent coin-glow">{totalCoins}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {PERMANENT_UPGRADES.map((upgrade) => (
            <ShopItem key={upgrade.id} upgrade={upgrade} totalCoins={totalCoins}
              level={getUpgradeLevel(upgrade.id)} cost={getUpgradeCost(upgrade.id)}
              onPurchase={purchasePermanentUpgrade} />
          ))}
        </div>

        <button
          onClick={handleBack}
          className="glass-panel px-8 py-3 rounded-xl font-display font-semibold text-foreground
            hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          BACK
        </button>
      </div>
    </div>
  );
};

const ShopItem = ({ upgrade, totalCoins, level, cost, onPurchase }: {
  upgrade: any; totalCoins: number; level: number; cost: number;
  onPurchase: (id: string) => boolean;
}) => {
  const maxed = level >= upgrade.maxLevel;
  const canAfford = totalCoins >= cost;
  const handleBuy = useSoundClick(() => onPurchase(upgrade.id));

  return (
    <div className="glass-panel p-4 flex items-center gap-4">
      <span className="text-3xl">{upgrade.icon}</span>
      <div className="flex-1">
        <h3 className="font-display font-bold text-foreground">{upgrade.name}</h3>
        <p className="text-xs text-muted-foreground font-body">{upgrade.description}</p>
        <div className="flex gap-1 mt-1">
          {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-1.5 rounded-full ${
                i < level ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
      <button
        onClick={handleBuy}
        disabled={maxed || !canAfford}
        className={`px-4 py-2 rounded-lg font-display font-bold text-sm transition-all duration-150 
          ${maxed
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : canAfford
              ? 'bg-gradient-to-r from-primary to-lava-glow text-primary-foreground hover:scale-105 active:scale-95'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
          }`}
      >
        {maxed ? 'MAX' : `🪙 ${cost}`}
      </button>
    </div>
  );
};

export default PermanentShop;
