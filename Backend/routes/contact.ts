import { Router, Request, Response } from 'express';
import { ContactController } from '../controllers/contactController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/contacts
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'List contacts' });
});

// POST /api/contacts
router.post('/', authenticateToken, ContactController.createContact);

// GET /api/contacts/search
router.get('/search', (req: Request, res: Response) => {
  res.json({ message: 'Search contacts' });
});

// GET /api/contacts/:id
router.get('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Get contact by ID' });
});

// PUT /api/contacts/:id
router.put('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Update contact' });
});

// DELETE /api/contacts/:id
router.delete('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Delete contact' });
});

// PUT /api/contacts/:id/block
router.put('/:id/block', (req: Request, res: Response) => {
  res.json({ message: 'Block/unblock contact' });
});

export default router; 