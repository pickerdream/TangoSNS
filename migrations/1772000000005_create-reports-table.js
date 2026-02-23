exports.up = (pgm) => {
    pgm.createTable('reports', {
        id: 'id',
        reporter_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        reported_user_id: {
            type: 'integer',
            references: '"users"',
            onDelete: 'CASCADE',
        },
        reported_wordbook_id: {
            type: 'integer',
            references: '"wordbooks"',
            onDelete: 'CASCADE',
        },
        reason: { type: 'text', notNull: true },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // Indexes for faster lookups in admin dashboard
    pgm.createIndex('reports', 'reported_user_id');
    pgm.createIndex('reports', 'reported_wordbook_id');
};

exports.down = (pgm) => {
    pgm.dropTable('reports');
};
