exports.up = (pgm) => {
    pgm.dropTable('wordbook_verifications', { ifExists: true });
    pgm.dropTable('word_verifications', { ifExists: true });

    pgm.createTable('wordbook_verifications', {
        id: 'id',
        wordbook_id: {
            type: 'integer',
            notNull: true,
            references: '"wordbooks"',
            onDelete: 'CASCADE',
        },
        user_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    pgm.addConstraint('wordbook_verifications', 'unique_user_wordbook_verification', {
        unique: ['user_id', 'wordbook_id'],
    });

    pgm.createIndex('wordbook_verifications', 'wordbook_id');
    pgm.createIndex('wordbook_verifications', 'user_id');
};

exports.down = (pgm) => {
    pgm.dropTable('wordbook_verifications');
};
