import type { CRMColumn, CRMRecord } from "./crmTypes";

export function sortRecords<T extends CRMRecord>(
  rows: T[],
  key: keyof T & string,
  direction: "asc" | "desc"
): T[] {
  const cloned = [...rows];
  cloned.sort((a, b) => {
    const valueA = String(a[key] ?? "");
    const valueB = String(b[key] ?? "");

    const maybeNumA = Number(valueA.replace(/[^0-9.-]/g, ""));
    const maybeNumB = Number(valueB.replace(/[^0-9.-]/g, ""));
    const bothNumeric = !Number.isNaN(maybeNumA) && !Number.isNaN(maybeNumB);

    if (bothNumeric) {
      return direction === "asc" ? maybeNumA - maybeNumB : maybeNumB - maybeNumA;
    }

    const aLower = valueA.toLowerCase();
    const bLower = valueB.toLowerCase();
    if (aLower < bLower) return direction === "asc" ? -1 : 1;
    if (aLower > bLower) return direction === "asc" ? 1 : -1;
    return 0;
  });

  return cloned;
}

export function filterRecords<T extends CRMRecord>(
  rows: T[],
  columns: CRMColumn<T>[],
  filters: Partial<Record<string, string>>,
  searchTerm?: string
): T[] {
  const columnKeys = new Set(columns.map((c) => c.key));
  const normalizedSearch = (searchTerm ?? "").trim().toLowerCase();

  return rows.filter((row) => {
    // 1. Global search term (across all visible columns)
    if (normalizedSearch) {
      const matchesSearch = visibleColumnsMatch(row, columns, normalizedSearch);
      if (!matchesSearch) return false;
    }

    // 2. Column-based filters (header filters)
    const columnMatch = columns.every((column) => {
      const filterValue = (filters[column.key] ?? "").trim().toLowerCase();
      if (!filterValue) return true;
      return String(row[column.key] ?? "").toLowerCase().includes(filterValue);
    });

    if (!columnMatch) return false;

    // 3. Extra filters (sidebar filters)
    return Object.entries(filters).every(([key, value]) => {
      if (typeof key === "string" && columnKeys.has(key as keyof T & string)) return true; // already handled
      const filterValue = (value ?? "").trim().toLowerCase();
      if (!filterValue) return true;
      
      // Fallback: try direct key access or find a mapping
      const rowValue = String(findRowValue(row, key) ?? "").toLowerCase();
      return rowValue.includes(filterValue);
    });
  });
}

function visibleColumnsMatch<T extends CRMRecord>(row: T, columns: CRMColumn<T>[], search: string): boolean {
  return columns.some((column) => {
    return String(row[column.key] ?? "").toLowerCase().includes(search);
  });
}

/** 
 * Handles key mismatches like 'product_name' vs 'productName' 
 */
function findRowValue<T extends CRMRecord>(row: T, key: string): any {
  if (key in row) return (row as any)[key];
  
  // Try camelCase conversion
  const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  if (camelKey in row) return (row as any)[camelKey];

  // Try snake_case conversion
  const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  if (snakeKey in row) return (row as any)[snakeKey];

  return null;
}

