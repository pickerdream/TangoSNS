exports.up = (pgm) => {
  // usersテーブルに管理者・BAN関連カラムを追加
  pgm.addColumns('users', {
    is_admin: { type: 'boolean', notNull: true, default: false },
    is_banned: { type: 'boolean', notNull: true, default: false },
    ban_reason: { type: 'text', notNull: false },
    registration_ip: { type: 'varchar(45)', notNull: false },
  });

  // 警告テーブルを作成
  pgm.createTable('user_warnings', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    admin_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'SET NULL',
    },
    reason: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('user_warnings', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('user_warnings');
  pgm.dropColumns('users', ['is_admin', 'is_banned', 'ban_reason', 'registration_ip']);
};
