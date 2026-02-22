/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // ユーザーテーブルの拡張
    pgm.addColumns('users', {
        avatar_url: { type: 'text' },
        bio: { type: 'text' }
    });

    // 単語帳の完了マークテーブル
    pgm.createTable('wordbook_completions', {
        user_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE'
        },
        wordbook_id: {
            type: 'integer',
            notNull: true,
            references: '"wordbooks"',
            onDelete: 'CASCADE'
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        }
    });

    // 複合主キー（一人が一つの単語帳に対して付けられる完了マークは一つまで）
    pgm.addConstraint('wordbook_completions', 'wordbook_completions_pkey', {
        primaryKey: ['user_id', 'wordbook_id']
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('wordbook_completions');
    pgm.dropColumns('users', ['avatar_url', 'bio']);
};
