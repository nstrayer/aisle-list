import { z } from "zod";

export const grocerySectionSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().describe("Descriptive name for this section"),
      type: z
        .enum(["grocery", "meal_plan", "crossed_out", "notes"])
        .describe("Type of section"),
      items: z.array(z.string()).describe("Items in this section"),
    })
  ),
});

export type GrocerySectionSchemaType = z.infer<typeof grocerySectionSchema>;
