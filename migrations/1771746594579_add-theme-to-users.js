/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.addColumn('users', {
        theme: { type: 'VARCHAR(10)', default: 'system', notNull: true }
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('users', 'theme');
};
