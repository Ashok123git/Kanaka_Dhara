import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { updateMyWholesaler } from '@/api/wholesalers';
import { saveWholesaler } from '@/lib/storage';
import { gstNumberSchema, panNumberSchema } from '@/lib/validation';
import { useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import type { Wholesaler } from '@/types';

const accountSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  mobile: z.string().min(10, 'Mobile number must be at least 10 digits'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  gstNumber: gstNumberSchema,
  panNumber: panNumberSchema,
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wholesaler: Wholesaler | null;
}

const AccountSheet = ({ isOpen, onClose, onSuccess, wholesaler }: AccountSheetProps) => {
  const { token } = useAuth();
  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      shopName: '',
      ownerName: '',
      mobile: '',
      address: '',
      gstNumber: '',
      panNumber: '',
    },
  });

  useEffect(() => {
    if (wholesaler && isOpen) {
      form.reset({
        shopName: wholesaler.shopName,
        ownerName: wholesaler.ownerName,
        mobile: wholesaler.mobile,
        address: wholesaler.address,
        gstNumber: wholesaler.gstNumber || '',
        panNumber: wholesaler.panNumber || '',
      });
    }
  }, [wholesaler, isOpen, form]);

  const onSubmit = async (data: AccountFormData) => {
    if (!wholesaler) return;
    if (!token) {
      toast.error('Not signed in');
      return;
    }

    try {
      const res = await updateMyWholesaler(token, {
        shopName: data.shopName,
        ownerName: data.ownerName,
        mobile: data.mobile,
        address: data.address,
        gstNumber: data.gstNumber || undefined,
        panNumber: data.panNumber || undefined,
      });
      const updatedWholesaler: Wholesaler = {
        ...wholesaler,
        ...res.wholesaler,
        panNumber:
          (res.wholesaler && res.wholesaler.panNumber) ??
          data.panNumber ??
          wholesaler.panNumber ??
          '',
      };
      saveWholesaler(updatedWholesaler);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        const body = JSON.parse(message) as { detail?: string };
        toast.error(body.detail ?? message);
      } catch {
        toast.error(message);
      }
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Account</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="shopName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shop Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter shop name" {...field} />
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
                    <Input placeholder="Enter owner name" {...field} />
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
                    <Input type="tel" placeholder="Enter mobile number" {...field} />
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
                  <FormLabel>Business Address *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter business address"
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
                    <Input placeholder="Enter GST number" {...field} />
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
                    <Input placeholder="Enter PAN number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-secondary hover:bg-secondary/90">
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default AccountSheet;
