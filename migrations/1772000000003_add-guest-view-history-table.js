exports.up = (pgm) => {
  pgm.createTable('guest_wordbook_views', {
    id: 'id',
    ip_address: {
      type: 'varchar(45)',
      notNull: true,
    },
    port: {
      type: 'integer',
      notNull: true,
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

  // IP + ポート + 単語帳IDは一意
  pgm.addConstraint('guest_wordbook_views', 'unique_guest_view', {
    unique: ['ip_address', 'port', 'wordbook_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('guest_wordbook_views');
};
