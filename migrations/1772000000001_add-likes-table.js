exports.up = (pgm) => {
  pgm.createTable('wordbook_likes', {
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
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // ユーザーと単語帳の組み合わせは一意
  pgm.addConstraint('wordbook_likes', 'unique_user_wordbook_like', {
    unique: ['user_id', 'wordbook_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('wordbook_likes');
};
