import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, MoreVertical, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/auth/useAuth';
import { updateMyWholesaler } from '@/api/wholesalers';
import { saveWholesaler } from '@/lib/storage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Wholesaler } from '@/types';

const registerSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  mobile: z.string().min(10, 'Enter a valid mobile number'),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
  const navigate = useNavigate();
  const { token, user, setAuth, clearToken } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      shopName: '',
      ownerName: '',
      mobile: '',
      address: '',
      gstNumber: '',
      panNumber: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    if (!token || !user) {
      setSubmitError('Session expired. Please log in again.');
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const body = {
        shopName: data.shopName,
        ownerName: data.ownerName,
        mobile: data.mobile,
        address: data.address || '',
        gstNumber: data.gstNumber || undefined,
        panNumber: data.panNumber || undefined,
      };
      const res = await updateMyWholesaler(token, body);
      const raw = res.wholesaler as unknown as Record<string, unknown>;
      // Backend may return snake_case or camelCase; normalize to Wholesaler shape
      const w: Wholesaler = {
        id: String(raw.id),
        shopName: String(raw.shopName ?? raw.shop_name),
        ownerName: String(raw.ownerName ?? raw.owner_name),
        mobile: String(raw.mobile),
        address: String(raw.address),
        gstNumber: String(raw.gstNumber ?? raw.gst_number ?? ''),
        panNumber: String((raw.panNumber ?? raw.pan_number) ?? ''),
        tradeCreditDays: Number(raw.tradeCreditDays ?? raw.trade_credit_days ?? 0),
        createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
        updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
      };
      saveWholesaler(w);
      // If backend returned a new token (first-time registration), update auth so JWT has wholesaler_id
      if (res.access_token) {
        setAuth(res.access_token, { id: user.id, phone: user.phone, wholesalerId: res.wholesaler.id }, true);
      }
      setIsSuccess(true);
      setTimeout(() => navigate('/home', { replace: true }), 1500);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      let message = rawMessage;
      try {
        const body = JSON.parse(rawMessage) as { detail?: string; message?: string };
        message = body.detail ?? body.message ?? rawMessage;
      } catch {
        // not JSON; use raw message
      }
      setSubmitError(message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary">
        <div className="flex flex-col items-center space-y-4 text-center">
          <CheckCircle2 className="h-20 w-20 text-primary-foreground animate-in zoom-in duration-300" />
          <h2 className="text-2xl font-bold text-primary-foreground">
            Registration Complete!
          </h2>
          <p className="text-primary-foreground/80">Setting up your ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-primary px-4 py-4">
        <button
          onClick={() => navigate('/')}
          className="p-1 text-primary-foreground hover:bg-primary-foreground/10 rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-primary-foreground">
          Register Your Business
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

      {/* Form */}
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="shopName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shop Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your shop name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter owner's name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number *</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Enter mobile number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your business address"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gstNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter GST number (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="panNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter PAN number (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-secondary hover:bg-secondary/90"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering…' : 'Register & Continue'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export { Register };
