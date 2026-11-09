import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.Middleware.js';
import type { CategoryController } from './category.controller.js';
import { roleMiddleware } from '../../middlewares/role.Middleware.js';
import { requireAdmin } from '../../config/allowedRoles.js';

export function createCategoryRoutes(controller: CategoryController): Router {
  const router = Router();
  router.get('/pag', controller.getCategoriesPaginated); // Usuário Lista as categorias
  router.get('/:id', controller.getCategoryById); // Usuário Busca a categoria
  router.get('/', controller.getCategories);  // só pra completar o crud
  router.post('/', authMiddleware, roleMiddleware(requireAdmin), controller.createCategory); // Admin - Cria categoria
  router.put('/:id', authMiddleware, roleMiddleware(requireAdmin), controller.updateCategory); // Admin - Atualiza categoria
  router.delete('/:id', authMiddleware, roleMiddleware(requireAdmin), controller.deleteCategory); // Admin - Deleta categoria
  return router;
}
