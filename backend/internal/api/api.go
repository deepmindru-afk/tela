package api

import "database/sql"

// Server bundles dependencies shared across HTTP handlers.
type Server struct {
	DB           *sql.DB
	rooms        *roomRegistry
	shareSecret  []byte
	shareLimiter *shareRateLimiter
}

func New(db *sql.DB) *Server {
	return &Server{
		DB:           db,
		rooms:        newRoomRegistry(),
		shareSecret:  loadOrGenerateShareSecret(),
		shareLimiter: newShareRateLimiter(),
	}
}
