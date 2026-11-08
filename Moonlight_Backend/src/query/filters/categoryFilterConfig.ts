import type { FilterConfig } from "@shared/query/filterConfigType.js";

type CategoryKeyFilters = "name";

export const categoryFilterConfig: FilterConfig<CategoryKeyFilters> = {
  name: { type: 'like', column: 'c.name' },
};