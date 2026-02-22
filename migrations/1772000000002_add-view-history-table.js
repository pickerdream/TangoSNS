exports.up = (pgm) => {
  pgm.createTable('wordbook_views', {
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
    viewed_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // ユーザーと単語帳の組み合わせは一意（最新の閲覧時刻のみを保持）
  pgm.addConstraint('wordbook_views', 'unique_user_wordbook_view', {
    unique: ['user_id', 'wordbook_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('wordbook_views');
};
