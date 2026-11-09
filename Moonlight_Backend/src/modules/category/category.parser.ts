import type { Request } from "express";
import { toBoolean, toInt, toString } from "@shared/query/queryParser.js";
import type { GetCategoriesPaginatedDTO } from "./dto/category.input.dto.js";

export const parseCategoriesQuery = (query: Request['query']): GetCategoriesPaginatedDTO => ({
    page: toInt(query.page, 1),
    limit: toInt(query.limit, 8),
    random: toBoolean(query.random),
    name: toString(query.name)
})
