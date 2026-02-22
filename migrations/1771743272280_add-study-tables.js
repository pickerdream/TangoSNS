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
    // 学習履歴テーブル
    pgm.createTable('study_history', {
        id: 'id',
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

    // 間違えた単語テーブル
    pgm.createTable('study_mistakes', {
        id: 'id',
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
        word_id: {
            type: 'integer',
            notNull: true,
            references: '"words"',
            onDelete: 'CASCADE'
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        }
    });

    // インデックス
    pgm.createIndex('study_history', 'user_id');
    pgm.createIndex('study_mistakes', 'user_id');
    pgm.createIndex('study_mistakes', ['user_id', 'wordbook_id', 'word_id'], { unique: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('study_mistakes');
    pgm.dropTable('study_history');
};
