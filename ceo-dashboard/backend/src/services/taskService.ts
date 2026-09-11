import pool from '../config/database';

export class TaskService {
    async getByUser(userId: string, status?: string) {
        let query = `SELECT t.*, u.full_name as assigned_name FROM tasks t
                     LEFT JOIN users u ON t.assigned_to = u.id WHERE t.user_id=$1`;
        const params: any[] = [userId];

        if (status && status !== 'all') {
            query += ' AND t.status=$2';
            params.push(status);
        }
        query += " ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.due_date";

        const result = await pool.query(query, params);
        return result.rows;
    }

    async getById(id: string) {
        const result = await pool.query(
            `SELECT t.*, u.full_name as assigned_name FROM tasks t
             LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id=$1`,
            [id]
        );
        return result.rows[0];
    }

    async create(data: any) {
        const result = await pool.query(
            `INSERT INTO tasks (user_id, title, description, due_date, priority, status, assigned_to, created_by)
             VALUES ($1,$2,$3,$4,$5,'pending',$6,$1) RETURNING *`,
            [data.userId, data.title, data.description, data.dueDate,
             data.priority || 'medium', data.assignedTo || data.userId]
        );
        return result.rows[0];
    }

    async update(id: string, data: any) {
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (data.title) { fields.push(`title=$${idx++}`); values.push(data.title); }
        if (data.description !== undefined) { fields.push(`description=$${idx++}`); values.push(data.description); }
        if (data.dueDate) { fields.push(`due_date=$${idx++}`); values.push(data.dueDate); }
        if (data.priority) { fields.push(`priority=$${idx++}`); values.push(data.priority); }
        if (data.status) {
            fields.push(`status=$${idx++}`); values.push(data.status);
            if (data.status === 'completed') { fields.push('completed_at=NOW()'); }
            if (data.status === 'reopened') { fields.push('completed_at=NULL'); }
        }
        if (data.assignedTo) { fields.push(`assigned_to=$${idx++}`); values.push(data.assignedTo); }

        fields.push('updated_at=NOW()');
        values.push(id);

        const result = await pool.query(
            `UPDATE tasks SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
            values
        );
        return result.rows[0];
    }

    async getCounts(userId: string) {
        const today = new Date().toISOString().split('T')[0];
        const [pending, todayTasks, completed] = await Promise.all([
            pool.query(`SELECT COUNT(*) as count FROM tasks WHERE user_id=$1 AND status IN ('pending','in_progress','reopened')`, [userId]),
            pool.query(`SELECT COUNT(*) as count FROM tasks WHERE user_id=$1 AND due_date=$2 AND status IN ('pending','in_progress','reopened')`, [userId, today]),
            pool.query(`SELECT COUNT(*) as count FROM tasks WHERE user_id=$1 AND status='completed'`, [userId])
        ]);
        return {
            pending: parseInt(pending.rows[0].count),
            today: parseInt(todayTasks.rows[0].count),
            completed: parseInt(completed.rows[0].count)
        };
    }
}

export const taskService = new TaskService();
