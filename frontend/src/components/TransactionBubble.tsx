import { Package, Truck, IndianRupee, RotateCcw, CheckCircle, Paperclip } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Transaction, Order } from '@/types';

interface TransactionBubbleProps {
  transaction: Transaction;
  orders: Order[];
  contactType: 'customer' | 'supplier';
  onBubbleClick?: () => void;
}

// Customer config: their actions come in, our actions go out
const customerConfig = {
  order_received: {
    label: 'Order Received',
    icon: Package,
    position: 'left' as const,
    bgClass: 'bg-card',
    accentClass: 'text-blue-600',
    borderClass: 'border-l-4 border-blue-500',
  },
  goods_sent: {
    label: 'Goods Sent',
    icon: Truck,
    position: 'right' as const,
    bgClass: 'bg-[hsl(var(--bubble-outgoing))]',
    accentClass: 'text-secondary',
    borderClass: '',
  },
  payment_received: {
    label: 'Payment Received',
    icon: IndianRupee,
    position: 'left' as const,
    bgClass: 'bg-card',
    accentClass: 'text-green-600',
    borderClass: 'border-l-4 border-green-500',
  },
  goods_returned: {
    label: 'Goods Returned',
    icon: RotateCcw,
    position: 'left' as const,
    bgClass: 'bg-card',
    accentClass: 'text-orange-600',
    borderClass: 'border-l-4 border-orange-500',
  },
  order_closed: {
    label: 'Order Closed',
    icon: CheckCircle,
    position: 'center' as const,
    bgClass: 'bg-muted/50',
    accentClass: 'text-muted-foreground',
    borderClass: '',
  },
};

// Supplier config: our actions go out, their actions come in
const supplierConfig = {
  order_received: {
    label: 'Order Placed',
    icon: Package,
    position: 'right' as const, // We placed the order (outgoing)
    bgClass: 'bg-[hsl(var(--bubble-outgoing))]',
    accentClass: 'text-blue-600',
    borderClass: '',
  },
  goods_sent: {
    label: 'Goods Received',
    icon: Truck,
    position: 'left' as const, // They sent goods to us (incoming)
    bgClass: 'bg-card',
    accentClass: 'text-green-600',
    borderClass: 'border-l-4 border-green-500',
  },
  payment_received: {
    label: 'Payment Made',
    icon: IndianRupee,
    position: 'right' as const, // We made payment (outgoing)
    bgClass: 'bg-[hsl(var(--bubble-outgoing))]',
    accentClass: 'text-orange-600',
    borderClass: '',
  },
  goods_returned: {
    label: 'Goods Returned',
    icon: RotateCcw,
    position: 'right' as const, // We returned goods (outgoing)
    bgClass: 'bg-[hsl(var(--bubble-outgoing))]',
    accentClass: 'text-orange-600',
    borderClass: '',
  },
  order_closed: {
    label: 'Order Closed',
    icon: CheckCircle,
    position: 'center' as const,
    bgClass: 'bg-muted/50',
    accentClass: 'text-muted-foreground',
    borderClass: '',
  },
};

const TransactionBubble = ({ transaction, orders, contactType, onBubbleClick }: TransactionBubbleProps) => {
  const { type, notes, orderId, paymentMode, attachments } = transaction;
  const amount = Number(transaction.amount) || 0;

  // Get linked order info
  const linkedOrder = orderId ? orders.find(o => o.id === orderId) : null;

  // Select config based on contact type
  const config = contactType === 'supplier' ? supplierConfig : customerConfig;
  const currentConfig = config[type];
  const Icon = currentConfig.icon;

  const hasAttachments = attachments && attachments.length > 0;

  // System message (order closed)
  if (currentConfig.position === 'center') {
    return (
      <div className="flex justify-center my-3">
        <div 
          className={`${currentConfig.bgClass} rounded-lg px-4 py-2 flex items-center gap-2 ${hasAttachments ? 'cursor-pointer hover:opacity-90' : ''}`}
          onClick={hasAttachments ? onBubbleClick : undefined}
        >
          <Icon className={`h-4 w-4 ${currentConfig.accentClass}`} />
          <span className="text-sm text-muted-foreground">
            {linkedOrder ? `Order #${linkedOrder.orderNumber} Closed` : 'Order Closed'}
          </span>
          {amount > 0 && (
            <span className="text-sm text-muted-foreground">
              • Discount: {formatCurrency(amount)}
            </span>
          )}
          {hasAttachments && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{attachments.length}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat bubble (left/right aligned)
  const isOutgoing = currentConfig.position === 'right';

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          ${currentConfig.bgClass}
          ${currentConfig.borderClass}
          ${isOutgoing ? 'rounded-lg rounded-tr-none mr-2 ml-12' : 'rounded-lg rounded-tl-none ml-2 mr-12'}
          max-w-[85%] shadow-sm px-3 py-2
          ${hasAttachments ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}
        `}
        onClick={hasAttachments ? onBubbleClick : undefined}
      >
        {/* Header with icon and label */}
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${currentConfig.accentClass}`} />
          <span className={`text-xs font-semibold ${currentConfig.accentClass}`}>
            {currentConfig.label}
          </span>
          {/* Attachment indicator in header */}
          {hasAttachments && (
            <div className="flex items-center gap-1 ml-auto">
              <Paperclip className={`h-3 w-3 ${currentConfig.accentClass}`} />
              <span className={`text-xs ${currentConfig.accentClass}`}>{attachments.length}</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="text-lg font-bold text-foreground">
          {formatCurrency(amount)}
        </div>

        {/* Payment mode for payments */}
        {(type === 'payment_received') && paymentMode && (
          <div className="text-xs text-muted-foreground capitalize">
            via {paymentMode === 'upi' ? 'UPI' : paymentMode}
          </div>
        )}

        {/* Order reference */}
        {linkedOrder && type !== 'order_received' && (
          <div className="text-xs text-muted-foreground mt-1">
            Order #{linkedOrder.orderNumber}
          </div>
        )}

        {/* Notes */}
        {notes && (
          <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">
            {notes}
          </p>
        )}

        {/* Attachment thumbnails preview */}
        {hasAttachments && (
          <div className="flex gap-1 mt-2 overflow-x-auto">
            {attachments.slice(0, 3).map((attachment, index) => (
              <div key={index} className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                <img 
                  src={attachment} 
                  alt={`Attachment ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {attachments.length > 3 && (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-muted-foreground">+{attachments.length - 3}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionBubble;
