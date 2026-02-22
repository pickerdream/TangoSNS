/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.addColumn('users', {
        theme: { type: 'VARCHAR(10)', default: 'system', notNull: true }
    });
};

export const down = (pgm) => {
    pgm.dropColumn('users', 'theme');
};
