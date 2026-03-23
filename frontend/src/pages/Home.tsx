import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreVertical, Users, Truck, BarChart3, Building2, MapPin, LogOut } from 'lucide-react';
import { getWholesaler } from '@/lib/storage';
import { getContacts as getContactsApi } from '@/api/contacts';
import { formatCurrency, formatDate, getInitials } from '@/lib/formatters';
import type { Wholesaler, Contact } from '@/types';

import FloatingActionButton from '@/components/FloatingActionButton';
import AddContactSheet from '@/components/AddContactSheet';
import OfficeSettings from '@/components/OfficeSettings';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/auth/useAuth';

type TabType = 'customers' | 'suppliers' | 'status' | 'office';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'customers', label: 'Customers', icon: <Users className="h-4 w-4" /> },
  { id: 'suppliers', label: 'Suppliers', icon: <Truck className="h-4 w-4" /> },
  { id: 'status', label: 'Status', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'office', label: 'Office', icon: <Building2 className="h-4 w-4" /> },
];

const Home = () => {
  const navigate = useNavigate();
  const { token, clearToken } = useAuth();
  const [wholesaler, setWholesaler] = useState<Wholesaler | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);

  // Extract unique cities for the current tab
  const uniqueCities = useMemo(() => {
    const contactType = activeTab === 'customers' ? 'customer' : 'supplier';
    const cities = contacts
      .filter(c => c.type === contactType && c.city)
      .map(c => c.city as string);
    return [...new Set(cities)].sort();
  }, [contacts, activeTab]);

  const loadContacts = useCallback(async () => {
    if (!token) return;
    setContactsLoading(true);
    try {
      const list = await getContactsApi(token);
      setContacts(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load contacts');
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const ws = getWholesaler();
    setWholesaler(ws ?? null);
    loadContacts();
  }, [navigate, token, loadContacts]);

  // Reset city filter when switching tabs
  useEffect(() => {
    setSelectedCity('all');
  }, [activeTab]);

  // Reset search query when switching tabs so filters are per-tab
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  const handleWholesalerUpdate = () => {
    setWholesaler(getWholesaler());
  };

  const filteredContacts = contacts
    .filter(c => c.type === (activeTab === 'customers' ? 'customer' : 'supplier'))
    .filter(c => selectedCity === 'all' || c.city === selectedCity)
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleContactClick = (contact: Contact) => {
    navigate(`/chat/${contact.id}`);
  };

  const handleAddContact = () => {
    setIsAddContactOpen(true);
  };

  const handleContactAdded = () => {
    loadContacts();
    setIsAddContactOpen(false);
  };

  const renderContactList = () => {
    if (contactsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">Loading contacts...</p>
        </div>
      );
    }
    if (filteredContacts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            {activeTab === 'customers' ? (
              <Users className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Truck className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-lg font-medium text-foreground">
            No {activeTab === 'customers' ? 'Customers' : 'Suppliers'} Yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the + button to add your first {activeTab === 'customers' ? 'customer' : 'supplier'}
          </p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border">
        {filteredContacts.map(contact => {
          const balance = Number(contact.balance);
          return (
            <div
              key={contact.id}
              data-testid="contact-item"
              onClick={() => handleContactClick(contact)}
              className="flex cursor-pointer items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
            >
              {/* Avatar */}
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <span className="text-lg font-semibold">{getInitials(contact.name)}</span>
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground truncate">{contact.name}</h3>
                  {contact.lastActivity && (
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {formatDate(contact.lastActivity)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {contact.businessType || 'No recent activity'}
                </p>
              </div>

              {/* Balance: color on amount only (same as Chat); Due/Overpaid label neutral */}
              <div className="flex-shrink-0 text-right">
                <span
                  className={`text-sm font-semibold ${
                    balance > 0
                      ? 'text-destructive'
                      : balance < 0
                      ? 'text-success'
                      : 'text-muted-foreground'
                  }`}
                >
                  {balance !== 0 ? formatCurrency(Math.abs(balance)) : '₹0'}
                </span>
                {balance !== 0 && (
                  <p className="text-xs text-muted-foreground">
                    {balance > 0 ? 'Due' : 'Overpaid'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPlaceholderTab = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground">Coming Soon</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Track order statuses and reports
      </p>
    </div>
  );

  const renderOfficeTab = () => (
    <OfficeSettings onWholesalerUpdate={handleWholesalerUpdate} />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-foreground">
            {wholesaler?.shopName || 'Ledger'}
          </h1>
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
                className="cursor-pointer text-destructive focus:text-destructive"
                onSelect={() => {
                  clearToken();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[52px] z-10 flex bg-primary px-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 flex-col items-center gap-1 border-b-2 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary-foreground text-primary-foreground'
                : 'border-transparent text-primary-foreground/60 hover:text-primary-foreground/80'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search Bar and City Filter - Only show for customers/suppliers */}
      {(activeTab === 'customers' || activeTab === 'suppliers') && (
        <div className="bg-muted px-4 py-2 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              data-testid="contacts-search-input"
            />
          </div>
          
          {uniqueCities.length > 0 && (
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-full bg-card" data-testid="contacts-city-filter">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Cities" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map(city => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {activeTab === 'customers' || activeTab === 'suppliers'
          ? renderContactList()
          : activeTab === 'office'
          ? renderOfficeTab()
          : renderPlaceholderTab()}
      </div>
      {/* Floating Action Button - Only show for customers/suppliers */}
      {(activeTab === 'customers' || activeTab === 'suppliers') && (
        <FloatingActionButton onClick={handleAddContact} />
      )}

      {/* Add Contact Sheet */}
      <AddContactSheet
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onSuccess={handleContactAdded}
        type={activeTab === 'customers' ? 'customer' : 'supplier'}
      />
    </div>
  );
};

export { Home };
