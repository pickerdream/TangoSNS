exports.up = (pgm) => {
    // 1. status のクォート問題を修正
    pgm.sql(`UPDATE word_corrections SET status = 'pending' WHERE status = '''pending'''`);
    pgm.sql(`UPDATE word_corrections SET status = 'approved' WHERE status = '''approved'''`);
    pgm.sql(`UPDATE word_corrections SET status = 'rejected' WHERE status = '''rejected'''`);
    pgm.alterColumn('word_corrections', 'status', {
        default: pgm.func("'pending'"),
    });

    // 2. correction_proposals テーブル作成
    pgm.createTable('correction_proposals', {
        id: 'id',
        wordbook_id: {
            type: 'integer',
            notNull: true,
            references: '"wordbooks"',
            onDelete: 'CASCADE',
        },
        suggester_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        title: { type: 'varchar(100)', notNull: true },
        description: { type: 'text' },
        status: { type: 'varchar(20)', notNull: true, default: pgm.func("'pending'") },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    pgm.createIndex('correction_proposals', 'wordbook_id');
    pgm.createIndex('correction_proposals', 'suggester_id');

    // 3. word_corrections に proposal_id を追加
    pgm.addColumns('word_corrections', {
        proposal_id: {
            type: 'integer',
            references: '"correction_proposals"',
            onDelete: 'CASCADE',
        },
    });
    pgm.createIndex('word_corrections', 'proposal_id');

    // 4. 既存データを個別提案として移行
    pgm.sql(`
        DO $$
        DECLARE
            r RECORD;
            new_id INTEGER;
        BEGIN
            FOR r IN SELECT id, wordbook_id, suggester_id, status, created_at FROM word_corrections WHERE proposal_id IS NULL
            LOOP
                INSERT INTO correction_proposals (wordbook_id, suggester_id, title, status, created_at)
                VALUES (r.wordbook_id, r.suggester_id, '修正提案', r.status, r.created_at)
                RETURNING id INTO new_id;
                UPDATE word_corrections SET proposal_id = new_id WHERE id = r.id;
            END LOOP;
        END $$;
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns('word_corrections', ['proposal_id']);
    pgm.dropTable('correction_proposals');
};
