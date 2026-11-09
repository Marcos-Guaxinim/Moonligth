import type { PaginatedResponse } from "@shared/types/pagination.js";
import { CategoryRepository } from "./category.repository.js";
import type { CreateCategoryDTO, GetCategoriesPaginatedDTO, UpdateCategoryDTO } from "./dto/category.input.dto.js";
import type { CategoryResponseDTO } from "./dto/category.output.dto.js";
import { buildSqlFilters } from "@shared/query/sqlFilterBuilder.js";
import { categoryFilterConfig } from "./category.filter.js";
import { validateCategory } from "./category.validator.js";

export class CategoryService {

    constructor(private categoryRepository: CategoryRepository) {}

        async findAllPaginated(query: GetCategoriesPaginatedDTO): Promise<PaginatedResponse<CategoryResponseDTO>> {
            const page = query.page || 1;
            const limit = query.limit || 5;
            const offset = (page - 1) * limit;
            const order = query.random ? `RAND()` : 'c.id_category ASC'; // se vai randomizar ou ordenar de forma crescente

            const { where, params } = buildSqlFilters(query, categoryFilterConfig);

            const data = await this.categoryRepository.findAllPaginated({filters: {dbParams: params, where, order}, pagination: {limit, offset}})
            const total = await this.categoryRepository.count({dbParams: params, where})

            return {data, total, page, totalPages: Math.ceil(total / limit)};
        }

        async findAll(): Promise<CategoryResponseDTO[]>{
            return this.categoryRepository.findAll();
        }

        async findById(id_category: number): Promise<CategoryResponseDTO | null> {
            return this.categoryRepository.findById(id_category);
        }

        async create(dto: CreateCategoryDTO): Promise<number>{
            validateCategory(dto);
            return this.categoryRepository.create(dto);
        }

        async update(dto: UpdateCategoryDTO): Promise<boolean>{
            validateCategory(dto);
            return this.categoryRepository.update(dto);
        }

        async delete(id_category: number): Promise<boolean>{
            return this.categoryRepository.delete(id_category);
        }

}
