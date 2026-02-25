exports.up = (pgm) => {
  // display_name カラムを追加 (最初はNULL許可)
  pgm.addColumn('users', {
    display_name: { type: 'varchar(100)' },
  });

  // 既存ユーザーのdisplay_nameをusernameからコピー
  pgm.sql('UPDATE users SET display_name = username');

  // 非ASCII文字を含むusernameを 'user_' + id に変更
  pgm.sql(`UPDATE users SET username = 'user_' || id WHERE username ~ '[^a-zA-Z0-9_]'`);

  // display_name を NOT NULL に変更
  pgm.alterColumn('users', 'display_name', { notNull: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'display_name');
};
