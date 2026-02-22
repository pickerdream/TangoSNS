exports.up = (pgm) => {
  pgm.createTable('wordbooks', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'cascade',
    },
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createTable('words', {
    id: 'id',
    wordbook_id: {
      type: 'integer',
      notNull: true,
      references: '"wordbooks"',
      onDelete: 'cascade',
    },
    word: { type: 'varchar(255)', notNull: true },
    meaning: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createTable('comments', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'cascade',
    },
    wordbook_id: {
      type: 'integer',
      notNull: true,
      references: '"wordbooks"',
      onDelete: 'cascade',
    },
    comment: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('comments');
  pgm.dropTable('words');
  pgm.dropTable('wordbooks');
};
