import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/users
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'List users' });
});

// POST /api/users
router.post('/', (req: Request, res: Response) => {
  res.json({ message: 'Create user' });
});

// GET /api/users/:id
router.get('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Get user by ID' });
});

// PUT /api/users/:id
router.put('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Update user' });
});

// DELETE /api/users/:id
router.delete('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Delete user' });
});

export default router; 