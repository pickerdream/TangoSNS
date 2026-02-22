exports.up = (pgm) => {
  // タグテーブル
  pgm.createTable('tags', {
    id: 'id',
    name: { type: 'varchar(50)', notNull: true, unique: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // 単語帳とタグの中間テーブル
  pgm.createTable('wordbook_tags', {
    id: 'id',
    wordbook_id: {
      type: 'integer',
      notNull: true,
      references: '"wordbooks"',
      onDelete: 'CASCADE',
    },
    tag_id: {
      type: 'integer',
      notNull: true,
      references: '"tags"',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('wordbook_tags', 'wordbook_id');
  pgm.createIndex('wordbook_tags', 'tag_id');
  pgm.addConstraint('wordbook_tags', 'unique_wordbook_tag', {
    unique: ['wordbook_id', 'tag_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('wordbook_tags');
  pgm.dropTable('tags');
};
