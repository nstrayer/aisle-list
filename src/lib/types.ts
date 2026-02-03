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

export interface ListSession {
  id: string;
  name: string;
  items: GroceryItem[];
  createdAt: number;
  updatedAt: number;
  hasImage: boolean;
}

export interface SessionIndexEntry {
  id: string;
  name: string;
  createdAt: number;
  itemCount: number;
  checkedCount: number;
  hasImage: boolean;
}
