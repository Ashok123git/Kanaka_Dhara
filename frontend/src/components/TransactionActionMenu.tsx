import { X, Package, Truck, IndianRupee, RotateCcw, CheckCircle } from 'lucide-react';
import type { TransactionType } from '@/types';

type LedgerTransactionType = Extract<
  TransactionType,
  'order_received' | 'goods_sent' | 'payment_received' | 'goods_returned' | 'order_closed'
>;

interface TransactionActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: LedgerTransactionType) => void;
  contactType: 'customer' | 'supplier';
}

const TransactionActionMenu = ({ isOpen, onClose, onSelect, contactType }: TransactionActionMenuProps) => {
  if (!isOpen) return null;

  // Actions available based on contact type
  const customerActions: { type: LedgerTransactionType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
    {
      type: 'order_received',
      label: 'Got the Order',
      description: 'Customer placed a new order',
      icon: <Package className="h-6 w-6" />,
      color: 'bg-blue-500',
    },
    {
      type: 'goods_sent',
      label: 'Goods Sent',
      description: 'Shipped goods to customer',
      icon: <Truck className="h-6 w-6" />,
      color: 'bg-secondary',
    },
    {
      type: 'payment_received',
      label: 'Received Payment',
      description: 'Customer made a payment',
      icon: <IndianRupee className="h-6 w-6" />,
      color: 'bg-green-500',
    },
    {
      type: 'goods_returned',
      label: 'Goods Returned',
      description: 'Customer returned goods',
      icon: <RotateCcw className="h-6 w-6" />,
      color: 'bg-orange-500',
    },
    {
      type: 'order_closed',
      label: 'Close Order',
      description: 'Mark order as complete',
      icon: <CheckCircle className="h-6 w-6" />,
      color: 'bg-muted-foreground',
    },
  ];

  // For suppliers, the terminology is different
  const supplierActions: { type: LedgerTransactionType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
    {
      type: 'order_received',
      label: 'Placed Order',
      description: 'We ordered from supplier',
      icon: <Package className="h-6 w-6" />,
      color: 'bg-blue-500',
    },
    {
      type: 'goods_sent',
      label: 'Goods Received',
      description: 'Received goods from supplier',
      icon: <Truck className="h-6 w-6" />,
      color: 'bg-secondary',
    },
    {
      type: 'payment_received',
      label: 'Made Payment',
      description: 'We paid the supplier',
      icon: <IndianRupee className="h-6 w-6" />,
      color: 'bg-green-500',
    },
    {
      type: 'goods_returned',
      label: 'Returned Goods',
      description: 'We returned goods to supplier',
      icon: <RotateCcw className="h-6 w-6" />,
      color: 'bg-orange-500',
    },
    {
      type: 'order_closed',
      label: 'Close Order',
      description: 'Mark order as complete',
      icon: <CheckCircle className="h-6 w-6" />,
      color: 'bg-muted-foreground',
    },
  ];

  const actions = contactType === 'customer' ? customerActions : supplierActions;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Menu */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Add Transaction</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {actions.map(action => (
            <button
              key={action.type}
              onClick={() => onSelect(action.type)}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors text-left"
            >
              <div className={`${action.color} p-3 rounded-full text-white`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{action.label}</div>
                <div className="text-sm text-muted-foreground">{action.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Safe area padding for mobile */}
        <div className="h-6" />
      </div>
    </>
  );
};

export default TransactionActionMenu;
