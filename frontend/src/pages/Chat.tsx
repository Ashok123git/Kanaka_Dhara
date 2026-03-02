import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Pencil } from 'lucide-react';
import { getTransactionsByContact } from '@/lib/storage';
import { getContact as getContactApi } from '@/api/contacts';
import { getOrders as getOrdersApi } from '@/api/orders';
import { getTransactions as getTransactionsApi } from '@/api/transactions';
import { formatCurrency, getInitials, formatDate } from '@/lib/formatters';
import type { Contact, Transaction, Order } from '@/types';

/** Ascending chronological order: oldest first (date, then createdAt). */
function sortTransactionsChronological(txns: Transaction[]): void {
  txns.sort((a, b) => {
    const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (byDate !== 0) return byDate;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/** Balance from transactions: Orders - Payments - Returns - Discounts (same logic as AddTransactionSheet). */
function balanceFromTransactions(txns: Transaction[]): number {
  let balance = 0;
  for (const t of txns) {
    const amount = typeof t.amount === 'number' ? t.amount : Number(t.amount);
    if (t.type === 'order_received') balance += amount;
    else if (
      t.type === 'payment_received' ||
      t.type === 'goods_returned' ||
      t.type === 'order_closed'
    )
      balance -= amount;
    // goods_sent does not affect balance
  }
  return balance;
}
import TransactionBubble from '@/components/TransactionBubble';
import TransactionActionMenu from '@/components/TransactionActionMenu';
import AddTransactionSheet from '@/components/AddTransactionSheet';
import EditContactSheet from '@/components/EditContactSheet';
import AttachmentViewerDialog from '@/components/AttachmentViewerDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/auth/useAuth';
import type { TransactionType } from '@/types';
import { toast } from 'sonner';

const Chat = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [contact, setContact] = useState<Contact | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isEditContactSheetOpen, setIsEditContactSheetOpen] = useState(false);
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Attachment viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<string[]>([]);

  const loadTransactions = useCallback(async () => {
    if (!contactId) return;
    if (token) {
      try {
        const txns = await getTransactionsApi(token, contactId);
        sortTransactionsChronological(txns);
        setTransactions(txns);
      } catch {
        setTransactions([]);
      }
    } else {
      const txns = getTransactionsByContact(contactId);
      sortTransactionsChronological(txns);
      setTransactions(txns);
    }
  }, [contactId, token]);

  useEffect(() => {
    if (!contactId) {
      navigate('/home', { replace: true });
      return;
    }
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [c, orderList, txns] = await Promise.all([
          getContactApi(token, contactId),
          getOrdersApi(token, contactId),
          getTransactionsApi(token, contactId),
        ]);
        if (!cancelled) {
          setContact(c);
          setOrders(orderList);
          sortTransactionsChronological(txns);
          setTransactions(txns);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Failed to load contact');
          navigate('/home', { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId, navigate, token]);

  useEffect(() => {
    // Scroll to bottom when transactions change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transactions]);

  const loadOrders = useCallback(async () => {
    if (!token || !contactId) return;
    try {
      const list = await getOrdersApi(token, contactId);
      setOrders(list);
    } catch {
      setOrders([]);
    }
  }, [token, contactId]);

  const loadContact = useCallback(async () => {
    if (!token || !contactId) return;
    try {
      const c = await getContactApi(token, contactId);
      setContact(c);
    } catch {
      setContact(null);
    }
  }, [token, contactId]);

  const handleActionSelect = (type: TransactionType) => {
    setSelectedTransactionType(type);
    setIsActionMenuOpen(false);
    setIsFormOpen(true);
  };

  const handleTransactionAdded = useCallback(async () => {
    await loadTransactions();
    await loadOrders();
    await loadContact();
    setIsFormOpen(false);
    setSelectedTransactionType(null);
  }, [loadTransactions, loadOrders, loadContact]);

  const handleBubbleClick = (transaction: Transaction) => {
    if (transaction.attachments && transaction.attachments.length > 0) {
      setViewerAttachments(transaction.attachments);
      setViewerOpen(true);
    }
  };

  // Group transactions by date
  const groupTransactionsByDate = (txns: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    
    txns.forEach(txn => {
      const dateKey = formatDate(txn.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(txn);
    });

    return groups;
  };

  const transactionGroups = groupTransactionsByDate(transactions);
  const headerBalance = balanceFromTransactions(transactions);

  if (loading || !contact) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--chat-bg))]">
        <p className="text-muted-foreground">{loading ? 'Loading...' : 'Contact not found.'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--chat-bg))]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary px-2 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/home')}
            className="p-2 text-primary-foreground hover:bg-primary-foreground/10 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Avatar */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <span className="text-sm font-semibold">{getInitials(contact.name)}</span>
          </div>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-primary-foreground truncate">{contact.name}</h1>
            <p className="text-xs text-primary-foreground/70">
              {contact.type === 'customer' ? 'Customer' : 'Supplier'} • {contact.businessType || 'Business'}
            </p>
          </div>

          {/* Balance (derived from displayed transactions so header matches list) */}
          <div className="text-right mr-2">
            <span
              className={`text-sm font-bold ${
                headerBalance > 0
                  ? 'text-red-300'
                  : headerBalance < 0
                  ? 'text-green-300'
                  : 'text-primary-foreground/70'
              }`}
            >
              {headerBalance !== 0 ? formatCurrency(Math.abs(headerBalance)) : '₹0'}
            </span>
            {headerBalance !== 0 && (
              <p className="text-xs text-primary-foreground/70">
                {headerBalance > 0 ? 'Due' : 'Advance'}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-2 text-primary-foreground hover:bg-primary-foreground/10 rounded-full transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => setIsEditContactSheetOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="bg-card rounded-lg px-6 py-4 shadow-sm">
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tap + to add your first transaction
              </p>
            </div>
          </div>
        ) : (
          <>
            {Object.entries(transactionGroups)
              .sort(([, a], [, b]) => new Date(a[0].date).getTime() - new Date(b[0].date).getTime())
              .map(([dateKey, txns]) => (
              <div key={dateKey}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm">
                    <span className="text-xs font-medium text-muted-foreground">{dateKey}</span>
                  </div>
                </div>

                {/* Transactions for this date */}
                {txns.map(transaction => (
                  <TransactionBubble
                    key={transaction.id}
                    transaction={transaction}
                    orders={orders}
                    contactType={contact.type}
                    onBubbleClick={() => handleBubbleClick(transaction)}
                  />
                ))}
              </div>
            ))}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsActionMenuOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Add transaction"
      >
        <span className="text-2xl font-light">+</span>
      </button>

      {/* Action Menu */}
      <TransactionActionMenu
        isOpen={isActionMenuOpen}
        onClose={() => setIsActionMenuOpen(false)}
        onSelect={handleActionSelect}
        contactType={contact.type}
      />

      {/* Transaction Form Sheet */}
      {selectedTransactionType && (
        <AddTransactionSheet
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedTransactionType(null);
          }}
          onSuccess={handleTransactionAdded}
          transactionType={selectedTransactionType}
          contactId={contact.id}
          orders={orders}
          contactType={contact.type}
        />
      )}

      {/* Edit Contact Sheet */}
      <EditContactSheet
        isOpen={isEditContactSheetOpen}
        onClose={() => setIsEditContactSheetOpen(false)}
        onSuccess={() => {
          loadContact();
        }}
        contact={contact}
      />

      {/* Attachment Viewer */}
      <AttachmentViewerDialog
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        attachments={viewerAttachments}
      />
    </div>
  );
};

export { Chat };
