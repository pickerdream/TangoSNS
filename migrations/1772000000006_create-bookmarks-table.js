exports.up = (pgm) => {
    pgm.createTable('wordbook_bookmarks', {
        id: 'id',
        user_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        wordbook_id: {
            type: 'integer',
            notNull: true,
            references: '"wordbooks"',
            onDelete: 'CASCADE',
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // Unique constraint to prevent duplicate bookmarks
    pgm.addConstraint('wordbook_bookmarks', 'unique_user_wordbook_bookmark', {
        unique: ['user_id', 'wordbook_id'],
    });

    pgm.createIndex('wordbook_bookmarks', 'user_id');
};

exports.down = (pgm) => {
    pgm.dropTable('wordbook_bookmarks');
};
