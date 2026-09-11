"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const database_1 = __importDefault(require("../config/database"));
class AuditService {
    async log(data) {
        const result = await database_1.default.query(`INSERT INTO audit_logs (user_id, action, record_type, record_id, old_data, new_data, ip_address)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [data.userId, data.action, data.recordType, data.recordId,
            data.oldData ? JSON.stringify(data.oldData) : null,
            data.newData ? JSON.stringify(data.newData) : null,
            data.ipAddress]);
        return result.rows[0];
    }
    async getByRecord(recordType, recordId) {
        const result = await database_1.default.query(`SELECT a.*, u.full_name as user_name FROM audit_logs a
             LEFT JOIN users u ON a.user_id = u.id
             WHERE a.record_type = $1 AND a.record_id = $2
             ORDER BY a.created_at DESC`, [recordType, recordId]);
        return result.rows;
    }
    async getRecent(limit = 50) {
        const result = await database_1.default.query(`SELECT a.*, u.full_name as user_name FROM audit_logs a
             LEFT JOIN users u ON a.user_id = u.id
             ORDER BY a.created_at DESC LIMIT $1`, [limit]);
        return result.rows;
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
//# sourceMappingURL=auditService.js.map