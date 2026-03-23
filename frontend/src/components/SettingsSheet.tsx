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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { saveWholesaler } from '@/lib/storage';
import type { Wholesaler } from '@/types';
import { useAuth } from '@/auth/useAuth';
import { updateMyWholesaler } from '@/api/wholesalers';

const settingsSchema = z.object({
  tradeCreditDays: z
    .number()
    .min(1, 'Minimum 1 day')
    .max(100, 'Maximum 100 days'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wholesaler: Wholesaler | null;
}

const SettingsSheet = ({ isOpen, onClose, onSuccess, wholesaler }: SettingsSheetProps) => {
  const { token } = useAuth();
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      tradeCreditDays: 30,
    },
  });

  useEffect(() => {
    if (wholesaler && isOpen) {
      form.reset({
        tradeCreditDays: wholesaler.tradeCreditDays || 30,
      });
    }
  }, [wholesaler, isOpen, form]);

  const onSubmit = async (data: SettingsFormData) => {
    if (!wholesaler) return;

    const updatedWholesaler: Wholesaler = {
      ...wholesaler,
      tradeCreditDays: data.tradeCreditDays,
    };

    if (token) {
      try {
        await updateMyWholesaler(token, {
          shopName: wholesaler.shopName,
          ownerName: wholesaler.ownerName,
          mobile: wholesaler.mobile,
          address: wholesaler.address,
          gstNumber: wholesaler.gstNumber || undefined,
          panNumber: wholesaler.panNumber || undefined,
          tradeCreditDays: data.tradeCreditDays,
        });
      } catch {
        // Persist locally anyway; user can retry later
      }
    }

    saveWholesaler(updatedWholesaler);
    onSuccess();
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-auto max-h-[50vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="tradeCreditDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Credit Period (Days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="30"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Default credit period for customers (1-100 days)
                  </FormDescription>
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
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsSheet;
