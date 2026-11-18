/**
 * The ROF reply fields our adapter relies on, as zod schemas (the `data` part of each reply).
 * Extra fields are fine (objects are loose); a missing or mistyped field is a contract break.
 * Sources: guide §4, §5, §7, §9, §10. Shapes marked ASSUMED are not in the guide.
 */
import { z } from 'zod';

const id = z.string().min(1);
const maybeText = z.string().nullable().optional();

export const categoriesSchema = z.array(z.looseObject({ id, name: z.string(), imageUrl: maybeText }));

const productBase = {
  id,
  name: z.string(),
  description: maybeText,
  status: z.string(),
  sellingPrice: z.number(),
  availableToSell: z.number(),
  allowOversell: z.boolean(),
  categoryId: maybeText,
  categoryName: maybeText,
  customFields: z.record(z.string(), z.unknown()).nullable().optional(),
};

export const productListSchema = z.array(z.looseObject({ ...productBase, primaryImageUrl: maybeText }));

export const productDetailSchema = z.looseObject({
  ...productBase,
  images: z.array(z.looseObject({ url: z.string(), isPrimary: z.boolean(), displayOrder: z.number().optional() })),
  customFieldDefinitions: z.array(
    z.looseObject({ fieldKey: z.string(), label: z.string(), dataType: z.string().optional(), displayOrder: z.number().optional() }),
  ),
});

/** GET /api/inventory/balances — verified on UAT 18 Nov 2026 (the guide, §6.2, shows no reply). */
export const stockBalancesSchema = z.array(
  z.looseObject({ productId: id, branchId: id, onHand: z.number(), reserved: z.number(), available: z.number(), allowOversell: z.boolean() }),
);

export const branchSchema = z.looseObject({
  id,
  name: z.string(),
  address: maybeText,
  phoneNumber: maybeText,
  latitude: z.number(),
  longitude: z.number(),
  city: maybeText,
  branchType: z.string(),
});
export const branchesSchema = z.array(branchSchema);

export const createdOrderSchema = z.looseObject({ id, orderNumber: z.number().int(), status: z.string() });

export const orderDetailSchema = z.looseObject({
  id,
  orderNumber: z.number().int(),
  status: z.string(),
  assignedToBranch: z.string().nullable(),
  assignBranchName: z.string().nullable().optional(),
  createdOn: z.string(),
  products: z.array(z.looseObject({ productId: id, productName: z.string(), quantity: z.number() })),
});

export const timelineSchema = z.array(z.looseObject({ statusTo: z.string(), createdOn: z.string() }));
