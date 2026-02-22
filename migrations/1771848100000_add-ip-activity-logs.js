exports.up = (pgm) => {
  pgm.createTable('user_ip_logs', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    ip_address: { type: 'varchar(45)', notNull: true },
    action: { type: 'varchar(20)', notNull: true }, // 'register', 'login'
    user_agent: { type: 'text', notNull: false },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('user_ip_logs', 'user_id');
  pgm.createIndex('user_ip_logs', 'ip_address');
};

exports.down = (pgm) => {
  pgm.dropTable('user_ip_logs');
};
