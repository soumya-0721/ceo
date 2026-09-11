import { Router, Response } from 'express';
import { taskService } from '../services/taskService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { status } = req.query;
        console.log('Tasks request - userId:', req.user!.id, 'status:', status);
        const tasks = await taskService.getByUser(req.user!.id, status as string);
        console.log('Tasks result:', tasks.length);
        res.json(tasks);
    } catch (error: any) {
        console.error('Tasks error:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to get tasks', detail: error.message });
    }
});

router.get('/counts', async (req: AuthRequest, res: Response) => {
    try {
        const counts = await taskService.getCounts(req.user!.id);
        res.json(counts);
    } catch (error: any) {
        console.error('Task counts error:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to get counts' });
    }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const task = await taskService.getById(req.params.id);
        if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get task' });
    }
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, dueDate, priority, assignedTo } = req.body;
        if (!title) {
            res.status(400).json({ error: 'Title required' });
            return;
        }
        const task = await taskService.create({
            userId: req.user!.id, title, description, dueDate,
            priority, assignedTo
        });

        await auditService.log({
            userId: req.user!.id, action: 'created', recordType: 'task',
            recordId: task.id, newData: task
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'New Task Created',
            `${req.user!.fullName} created task "${title}"`,
            'created', 'task', task.id, null, task
        );

        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const oldTask = await taskService.getById(req.params.id);
        const updated = await taskService.update(req.params.id, req.body);

        await auditService.log({
            userId: req.user!.id, action: 'updated', recordType: 'task',
            recordId: req.params.id, oldData: oldTask, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Task Updated',
            `${req.user!.fullName} updated task "${updated.title}"`,
            'updated', 'task', req.params.id, oldTask, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});

router.patch('/:id/complete', async (req: AuthRequest, res: Response) => {
    try {
        const oldTask = await taskService.getById(req.params.id);
        const updated = await taskService.update(req.params.id, { status: 'completed' });

        await auditService.log({
            userId: req.user!.id, action: 'completed', recordType: 'task',
            recordId: req.params.id, oldData: oldTask, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Task Completed',
            `${req.user!.fullName} completed task "${updated.title}"`,
            'completed', 'task', req.params.id, oldTask, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

router.patch('/:id/reopen', async (req: AuthRequest, res: Response) => {
    try {
        const oldTask = await taskService.getById(req.params.id);
        const updated = await taskService.update(req.params.id, { status: 'reopened' });

        await auditService.log({
            userId: req.user!.id, action: 'reopened', recordType: 'task',
            recordId: req.params.id, oldData: oldTask, newData: updated
        });

        await notificationService.notifyOtherUser(
            req.user!.id, 'Task Reopened',
            `${req.user!.fullName} reopened task "${updated.title}"`,
            'reopened', 'task', req.params.id, oldTask, updated
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to reopen task' });
    }
});

export default router;
