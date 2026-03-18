import { useState } from 'react';
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
import { createContact } from '@/api/contacts';
import { useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import { gstNumberSchema } from '@/lib/validation';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  gstNumber: gstNumberSchema,
  businessType: z.string().optional(),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface AddContactSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'customer' | 'supplier';
}

const AddContactSheet = ({ isOpen, onClose, onSuccess, type }: AddContactSheetProps) => {
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      mobile: '',
      city: '',
      address: '',
      gstNumber: '',
      businessType: '',
      notes: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    if (!token) {
      toast.error('Not signed in');
      return;
    }
    setSubmitting(true);
    try {
      await createContact(token, {
        type,
        name: data.name,
        mobile: data.mobile,
        city: data.city,
        address: data.address,
        gstNumber: data.gstNumber,
        businessType: data.businessType,
        notes: data.notes,
      });
      toast.success('Contact added');
      form.reset();
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSubmitting(false);
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
          <SheetTitle>
            Add New {type === 'customer' ? 'Customer' : 'Supplier'}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" data-testid="add-contact-form">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" data-testid="add-contact-name" {...field} />
                  </FormControl>
                  <FormMessage data-testid="add-contact-name-error" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Enter mobile number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City/Town</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter city or town" {...field} />
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
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter address"
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
              name="businessType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Retail, Wholesale" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
                      className="resize-none"
                      {...field}
                    />
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
              <Button type="submit" className="flex-1 bg-secondary hover:bg-secondary/90" disabled={submitting} data-testid="add-contact-submit">
                {submitting ? 'Saving...' : `Save ${type === 'customer' ? 'Customer' : 'Supplier'}`}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default AddContactSheet;
