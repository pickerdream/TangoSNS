exports.up = (pgm) => {
  pgm.addColumn('user_ip_logs', {
    port: { type: 'integer', notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('user_ip_logs', 'port');
};
