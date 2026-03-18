import { z } from 'zod';

// Indian GSTIN: 15 characters with state code, PAN, entity, Z, and checksum.
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Indian PAN: 10 characters, 5 letters, 4 digits, 1 letter.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const gstNumberSchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .refine(
    value => value === '' || GST_REGEX.test(value),
    { message: 'Enter a valid GST number' }
  );

export const panNumberSchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .refine(
    value => value === '' || PAN_REGEX.test(value),
    { message: 'Enter a valid PAN number' }
  );

