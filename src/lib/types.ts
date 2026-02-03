export interface GrocerySection {
  name: string;
  type: "grocery" | "meal_plan" | "crossed_out" | "notes";
  items: string[];
}

export interface AnalyzeResponse {
  sections: GrocerySection[];
}

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}
