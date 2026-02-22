/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.createTable('notifications', {
        id: 'id',
        user_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'cascade' },
        type: { type: 'varchar(20)', notNull: true }, // e.g., 'comment'
        message: { type: 'text', notNull: true },
        link: { type: 'text' }, // e.g., '#/wordbook/1'
        is_read: { type: 'boolean', default: false, notNull: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
    });
    pgm.createIndex('notifications', 'user_id');
};

export const down = (pgm) => {
    pgm.dropTable('notifications');
};
