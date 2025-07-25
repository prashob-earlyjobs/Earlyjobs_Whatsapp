import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/templates
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'List templates' });
});

// POST /api/templates
router.post('/', (req: Request, res: Response) => {
  res.json({ message: 'Create template' });
});

// GET /api/templates/categories
router.get('/categories', (req: Request, res: Response) => {
  res.json({ message: 'List template categories' });
});

// GET /api/templates/:id
router.get('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Get template by ID' });
});

// PUT /api/templates/:id
router.put('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Update template' });
});

// DELETE /api/templates/:id
router.delete('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Delete template' });
});

export default router; 