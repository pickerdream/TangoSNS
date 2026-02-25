exports.up = (pgm) => {
  pgm.addColumn('users', {
    google_id: { type: 'varchar(255)', unique: true },
  });

  pgm.alterColumn('users', 'password', { notNull: false });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'google_id');
  pgm.alterColumn('users', 'password', { notNull: true });
};
