import { useEffect, useState } from 'react';
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
import { updateContact } from '@/api/contacts';
import { useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import type { Contact } from '@/types';
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

interface EditContactSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contact: Contact | null;
}

const EditContactSheet = ({ isOpen, onClose, onSuccess, contact }: EditContactSheetProps) => {
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

  useEffect(() => {
    if (isOpen && contact) {
      form.reset({
        name: contact.name ?? '',
        mobile: contact.mobile ?? '',
        city: contact.city ?? '',
        address: contact.address ?? '',
        gstNumber: contact.gstNumber ?? '',
        businessType: contact.businessType ?? '',
        notes: contact.notes ?? '',
      });
    }
  }, [isOpen, contact, form]);

  const onSubmit = async (data: ContactFormData) => {
    if (!token || !contact) {
      toast.error('Not signed in or no contact');
      return;
    }
    setSubmitting(true);
    try {
      await updateContact(token, contact.id, {
        name: data.name,
        mobile: data.mobile,
        city: data.city,
        address: data.address,
        gstNumber: data.gstNumber,
        businessType: data.businessType,
        notes: data.notes,
      });
      toast.success('Contact updated');
      form.reset();
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!contact) return null;

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>
            Edit {contact.type === 'customer' ? 'Customer' : 'Supplier'}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" data-testid="edit-contact-form">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" data-testid="edit-contact-name" {...field} />
                  </FormControl>
                  <FormMessage data-testid="edit-contact-name-error" />
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
              <Button type="submit" className="flex-1 bg-secondary hover:bg-secondary/90" disabled={submitting} data-testid="edit-contact-submit">
                {submitting ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default EditContactSheet;
