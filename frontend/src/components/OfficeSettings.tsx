import { useState } from 'react';
import { User, Settings, Database, HelpCircle, Bell, ChevronRight } from 'lucide-react';
import { getWholesaler } from '@/lib/storage';
import { getInitials } from '@/lib/formatters';
import type { Wholesaler } from '@/types';
import AccountSheet from './AccountSheet';
import SettingsSheet from './SettingsSheet';

interface SettingsMenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  available: boolean;
}

const menuItems: SettingsMenuItem[] = [
  {
    id: 'account',
    icon: <User className="h-5 w-5" />,
    label: 'Account',
    description: 'Business profile & details',
    available: true,
  },
  {
    id: 'settings',
    icon: <Settings className="h-5 w-5" />,
    label: 'Settings',
    description: 'Trade credit, preferences',
    available: true,
  },
  {
    id: 'storage',
    icon: <Database className="h-5 w-5" />,
    label: 'Storage and Data',
    description: 'Coming soon',
    available: false,
  },
  {
    id: 'help',
    icon: <HelpCircle className="h-5 w-5" />,
    label: 'Help and Feedback',
    description: 'Coming soon',
    available: false,
  },
  {
    id: 'notifications',
    icon: <Bell className="h-5 w-5" />,
    label: 'Notifications',
    description: 'Coming soon',
    available: false,
  },
];

interface OfficeSettingsProps {
  onWholesalerUpdate?: () => void;
}

const OfficeSettings = ({ onWholesalerUpdate }: OfficeSettingsProps) => {
  const [wholesaler, setWholesaler] = useState<Wholesaler | null>(getWholesaler());
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleMenuClick = (itemId: string) => {
    if (itemId === 'account') {
      setIsAccountOpen(true);
    } else if (itemId === 'settings') {
      setIsSettingsOpen(true);
    }
  };

  const handleAccountUpdate = () => {
    setWholesaler(getWholesaler());
    setIsAccountOpen(false);
    onWholesalerUpdate?.();
  };

  const handleSettingsUpdate = () => {
    setWholesaler(getWholesaler());
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex flex-col">
      {/* Business Profile Header */}
      <div className="flex items-center gap-4 bg-card px-4 py-6 border-b border-border">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <span className="text-xl font-bold">
            {wholesaler ? getInitials(wholesaler.shopName) : 'GH'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {wholesaler?.shopName || 'Your Business'}
          </h2>
          <p className="text-sm text-muted-foreground truncate">
            {wholesaler?.ownerName || 'Owner Name'}
          </p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="divide-y divide-border">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => item.available && handleMenuClick(item.id)}
            disabled={!item.available}
            className={`flex w-full items-center gap-4 px-4 py-4 text-left transition-colors ${
              item.available
                ? 'hover:bg-muted/50 active:bg-muted'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary/50 text-secondary-foreground">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground">{item.label}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            {item.available && (
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Account Sheet */}
      <AccountSheet
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onSuccess={handleAccountUpdate}
        wholesaler={wholesaler}
      />

      {/* Settings Sheet */}
      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSuccess={handleSettingsUpdate}
        wholesaler={wholesaler}
      />
    </div>
  );
};

export default OfficeSettings;
