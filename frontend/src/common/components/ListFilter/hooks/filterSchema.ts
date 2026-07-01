import z from 'zod';

export const schema = z.object({
  filters: z.array(
    z.object({
      enabled: z.boolean(),
      searchItem: z.string().nullable(),
      condition: z.string().nullable(),
      value: z
        .union([
          z.object({
            type: z.literal('single'),
            value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
          }),
          z.object({
            type: z.literal('range'),
            from: z.string().nullable().optional(),
            to: z.string().nullable().optional(),
          }),
          z.object({ type: z.literal('blank') }),
          z.object({ type: z.literal('present') }),
          z.any(),
        ])
        .nullable(),
    }),
  ),
  searchValue: z.string().optional(),
});

export type ListFilterForm = z.infer<typeof schema>;
