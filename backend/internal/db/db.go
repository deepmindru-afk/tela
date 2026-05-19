package db

import (
	"database/sql"
	"fmt"
	"net/url"

	_ "modernc.org/sqlite"
)

// Open opens (and creates if missing) a SQLite database at path, configured
// for WAL journaling, enforced foreign keys, a 5s busy timeout, and BEGIN
// IMMEDIATE for every transaction (_txlock=immediate). Using IMMEDIATE means
// the busy handler covers writer contention up-front instead of failing on
// DEFERRED-tx write-promotion, which is unrecoverable.
func Open(path string) (*sql.DB, error) {
	q := url.Values{}
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "foreign_keys(on)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Set("_txlock", "immediate")
	dsn := fmt.Sprintf("file:%s?%s", path, q.Encode())

	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite at %s: %w", path, err)
	}
	if err := d.Ping(); err != nil {
		d.Close()
		return nil, fmt.Errorf("ping sqlite at %s: %w", path, err)
	}
	return d, nil
}
