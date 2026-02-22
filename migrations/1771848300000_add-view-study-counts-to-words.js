exports.up = (pgm) => {
  pgm.addColumns('words', {
    view_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    study_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('words', ['view_count', 'study_count']);
};