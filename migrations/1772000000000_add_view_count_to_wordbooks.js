exports.up = (pgm) => {
  pgm.addColumns('wordbooks', {
    view_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('wordbooks', ['view_count']);
};