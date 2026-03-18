import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Package, Truck, IndianRupee, RotateCcw, CheckCircle, Camera, X } from 'lucide-react';
import { storageApi as storage } from '@/lib/storage';
import { ordersApi as ordersApi } from '@/api/orders';
import { transactionsApi as transactionsApi } from '@/api/transactions';
import { useAuth } from '@/auth/useAuth';
import { generateId } from '@/lib/formatters';
import { imageUtilsApi as imageUtils } from '@/lib/imageUtils';
import { toast } from 'sonner';
import type { TransactionType, Transaction, Order } from '@/types';

/** Convert a data URL (e.g. from compressed image) to a File for upload. */
function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bstr = atob(arr[1] ?? '');
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new File([u8], filename, { type: mime });
}

interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionType: Extract<
    TransactionType,
    'order_received' | 'goods_sent' | 'payment_received' | 'goods_returned' | 'order_closed'
  >;
  contactId: string;
  orders: Order[];
  contactType: 'customer' | 'supplier';
}

// Customer-facing labels
const customerConfig = {
  order_received: {
    title: 'New Order',
    icon: Package,
    color: 'text-blue-600',
  },
  goods_sent: {
    title: 'Goods Sent',
    icon: Truck,
    color: 'text-secondary',
  },
  payment_received: {
    title: 'Payment Received',
    icon: IndianRupee,
    color: 'text-green-600',
  },
  goods_returned: {
    title: 'Goods Returned',
    icon: RotateCcw,
    color: 'text-orange-600',
  },
  order_closed: {
    title: 'Close Order',
    icon: CheckCircle,
    color: 'text-muted-foreground',
  },
};

// Supplier-facing labels (reversed perspective)
const supplierConfig = {
  order_received: {
    title: 'Place Order',
    icon: Package,
    color: 'text-blue-600',
  },
  goods_sent: {
    title: 'Goods Received',
    icon: Truck,
    color: 'text-green-600',
  },
  payment_received: {
    title: 'Make Payment',
    icon: IndianRupee,
    color: 'text-orange-600',
  },
  goods_returned: {
    title: 'Return Goods',
    icon: RotateCcw,
    color: 'text-orange-600',
  },
  order_closed: {
    title: 'Close Order',
    icon: CheckCircle,
    color: 'text-muted-foreground',
  },
};

const AddTransactionSheet = ({
  isOpen,
  onClose,
  onSuccess,
  transactionType,
  contactId,
  orders,
  contactType,
}: AddTransactionSheetProps) => {
  const { token } = useAuth();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'cheque' | 'upi' | 'bank' | 'adjustment'>('cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get open orders for selection
  const openOrders = orders.filter(o => o.status === 'open');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
      setOrderNumber('');
      setSelectedOrderId('');
      setPaymentMode('cash');
      setDate(new Date().toISOString().split('T')[0]);
      setAttachments([]);
    }
  }, [isOpen, openOrders.length]);

  // Select config based on contact type
  const transactionConfig = contactType === 'supplier' ? supplierConfig : customerConfig;
  const config = transactionConfig[transactionType];
  const Icon = config.icon;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    setIsCompressing(true);

    try {
      if (!files || files.length === 0) return;

      const newAttachments: string[] = [];

      for (const file of Array.from(files)) {
        if (imageUtils.isImageFile(file)) {
          const compressed = await imageUtils.compressImage(file, 1200, 0.7);
          newAttachments.push(compressed);
        }
      }

      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Failed to process images:', error);
    } finally {
      setIsCompressing(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount))) {
      toast.error('Enter a valid amount');
      return;
    }

    // For new order, order number is required
    if (transactionType === 'order_received' && !orderNumber.trim()) {
      toast.error('Order number is required');
      return;
    }

    // For transactions that need an order, validate selection
    if (transactionType !== 'order_received' && openOrders.length > 0 && !selectedOrderId) {
      toast.error('Select an order');
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionDate = new Date(date);
      const amountNum = Number(amount) || 0;
      if (amountNum <= 0) {
        toast.error('Enter a valid amount');
        return;
      }

      const dateStr = transactionDate.toISOString().split('T')[0];
      const nowIso = new Date().toISOString();

      // Create the transaction (date/createdAt/updatedAt as strings for type and storage)
      const transaction: Transaction = {
        id: generateId(),
        contactId,
        wholesalerId: '',
        type: transactionType,
        date: dateStr,
        amount: amountNum,
        notes: notes.trim() || '',
        orderId: transactionType === 'order_received' ? null : selectedOrderId || null,
        paymentMode: transactionType === 'payment_received' ? paymentMode : '',
        attachments: attachments.length > 0 ? attachments : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // If it's a new order, create the order via API first
      if (transactionType === 'order_received') {
        if (!token) {
          toast.error('Not signed in');
          return;
        }
        try {
          const created = await ordersApi.createOrder(token, {
            contactId,
            orderNumber: orderNumber.trim(),
            date: dateStr,
            totalValue: amountNum,
            paidAmount: 0,
            returnedValue: 0,
            discount: 0,
            status: 'open',
          });
          transaction.orderId = created.id;
          // Keep local storage in sync for transactions that reference this order
          const allOrders = storage.getOrders();
          allOrders.push(created);
          storage.saveOrders(allOrders);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          try {
            const body = JSON.parse(message) as { detail?: string };
            toast.error(body.detail ?? message);
          } catch {
            toast.error(message);
          }
          return;
        }
      }

      // Persist transaction to backend when signed in, then keep local in sync
      if (token) {
        try {
          const created = await transactionsApi.createTransaction(token, {
            contact_id: contactId,
            type: transactionType,
            date: dateStr,
            order_id: transaction.orderId ?? null,
            amount: amountNum,
            notes: notes.trim() || null,
            payment_mode: transactionType === 'payment_received' ? paymentMode : null,
          });
          const createdId = typeof created?.id === 'string' ? created.id : transaction.id;
          transaction.id = createdId;

          // Upload attachments so they appear when refetching from API
          if (attachments.length > 0) {
            for (let i = 0; i < attachments.length; i++) {
              try {
                const file = dataURLtoFile(attachments[i], `attachment-${i + 1}.jpg`);
                await transactionsApi.uploadTransactionAttachment(token, createdId, file);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to upload attachment');
              }
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          try {
            const body = JSON.parse(message) as { detail?: string };
            toast.error(body.detail ?? message);
          } catch {
            toast.error(message);
          }
          return;
        }
      }
      storage.addTransaction(transaction);

      // Update the order via API if applicable
      if (selectedOrderId && transactionType !== 'order_received') {
        const allOrders = storage.getOrders();
        const orderIndex = allOrders.findIndex(o => o.id === selectedOrderId);
        
        if (orderIndex !== -1) {
          const order = allOrders[orderIndex];
          
          if (transactionType === 'payment_received') {
            order.paidAmount += amountNum;
          } else if (transactionType === 'goods_returned') {
            order.returnedValue += amountNum;
          } else if (transactionType === 'order_closed') {
            order.discount = amountNum;
            order.status = 'closed';
          }

          if (token) {
            try {
              await ordersApi.updateOrder(token, order.id, {
                paidAmount: order.paidAmount,
                returnedValue: order.returnedValue,
                discount: order.discount,
                status: order.status,
              });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to update order');
            }
          }
          storage.saveOrders(allOrders);
        }
      }

      // When not logged in, keep local contact balance in sync; when logged in, backend already updated it and Chat refetches contact
      if (!token) {
        const contacts = storage.getContacts();
        const contactIndex = contacts.findIndex(c => c.id === contactId);
        if (contactIndex !== -1) {
          const contact = contacts[contactIndex];
          if (transactionType === 'order_received') {
            contact.balance += amountNum;
          } else if (transactionType === 'payment_received' || transactionType === 'goods_returned' || transactionType === 'order_closed') {
            contact.balance -= amountNum;
          }
          contact.lastActivity = new Date().toISOString();
          storage.updateContact(contactId, {
            balance: contact.balance,
            lastActivity: contact.lastActivity,
          });
        }
      }

      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsOrderSelector = transactionType !== 'order_received' && openOrders.length > 0;
  const needsPaymentMode = transactionType === 'payment_received';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-muted ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <SheetTitle>{config.title}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Order Number (New Order only) */}
          {transactionType === 'order_received' && (
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                id="orderNumber"
                type="text"
                placeholder="Enter order number"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Order Selector */}
          {needsOrderSelector && (
            <div className="space-y-2">
              <Label>Select Order</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger data-testid="order-select-trigger">
                  <SelectValue placeholder="Select an order" />
                </SelectTrigger>
                <SelectContent>
                  {openOrders.map(order => (
                    <SelectItem key={order.id} value={order.id}>
                      #{order.orderNumber} - ₹{order.totalValue.toLocaleString('en-IN')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              placeholder="Enter amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-lg"
            />
          </div>

          {/* Payment Mode */}
          {needsPaymentMode && (
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as typeof paymentMode)}>
                <SelectTrigger data-testid="payment-mode-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              Attachments
            </Label>
            
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative w-16 h-16">
                    <img 
                      src={attachment} 
                      alt={`Attachment ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      data-testid={`remove-attachment-${index}`}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add attachment button */}
            <input
              ref={fileInputRef}
              data-testid="attachment-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="attachment-add-button"
              disabled={isCompressing}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              {isCompressing ? 'Processing...' : 'Add Photo / Document'}
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            data-testid="submit-transaction"
            disabled={
              isSubmitting ||
              !amount ||
              false
            }
            className="w-full h-12 text-base font-semibold"
          >
            {isSubmitting ? 'Saving...' : 'Save Transaction'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddTransactionSheet;
