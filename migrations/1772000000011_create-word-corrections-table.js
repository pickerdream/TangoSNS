exports.up = (pgm) => {
    pgm.createTable('word_corrections', {
        id: 'id',
        word_id: {
            type: 'integer',
            notNull: true,
            references: '"words"',
            onDelete: 'CASCADE',
        },
        wordbook_id: {
            type: 'integer',
            notNull: true,
            references: '"wordbooks"',
            onDelete: 'CASCADE',
        },
        suggester_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        suggested_word: { type: 'varchar(255)', notNull: true },
        suggested_meaning: { type: 'text', notNull: true },
        status: { type: 'varchar(20)', notNull: true, default: "'pending'" },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    pgm.createIndex('word_corrections', 'word_id');
    pgm.createIndex('word_corrections', 'wordbook_id');
    pgm.createIndex('word_corrections', 'suggester_id');
};

exports.down = (pgm) => {
    pgm.dropTable('word_corrections');
};
