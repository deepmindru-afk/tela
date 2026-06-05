package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/zcag/tela/backend/internal/auth"
)

const (
	roleOwner  = "owner"
	roleEditor = "editor"
	roleViewer = "viewer"
)

// canEdit is true for owner + editor — the gate for any page mutation
// (CREATE/PATCH/DELETE/move).
func canEdit(role string) bool {
	return role == roleOwner || role == roleEditor
}

// requireUser pulls the authenticated user off the request context. Returns
// (nil, false) and writes 401 when called outside the middleware — shouldn't
// happen for wrapped routes, but defends against accidental misuse.
func requireUser(w http.ResponseWriter, r *http.Request) (*auth.User, bool) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return nil, false
	}
	return u, true
}

// requireInstanceAdmin gates an endpoint to instance-admins only. Writes the
// 401 envelope when the caller isn't authenticated (defensive — should be
// caught by middleware), or the 403 envelope when the caller is authenticated
// but not an instance admin.
func requireInstanceAdmin(w http.ResponseWriter, r *http.Request) (*auth.User, bool) {
	u, ok := requireUser(w, r)
	if !ok {
		return nil, false
	}
	if !u.IsInstanceAdmin {
		writeError(w, http.StatusForbidden, "forbidden", "instance admin required")
		return nil, false
	}
	return u, true
}

// effectiveRoleQuery resolves a user's single effective role on a space from
// the space_access view (direct user grants ∪ org grants), picking the highest
// by precedence (owner > editor > viewer). Returns sql.ErrNoRows when the user
// has no access at all — preserving the pre-orgs spaceRole contract.
const effectiveRoleQuery = `
	SELECT role FROM space_access
	 WHERE space_id = $1 AND user_id = $2
	 ORDER BY CASE role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END DESC
	 LIMIT 1`

// spaceRole returns the user's effective role for spaceID, or sql.ErrNoRows
// when they have no access (directly or via any org).
func spaceRole(ctx context.Context, db *sql.DB, userID, spaceID int64) (string, error) {
	var role string
	err := db.QueryRowContext(ctx, effectiveRoleQuery, spaceID, userID).Scan(&role)
	return role, err
}

// spaceRoleTx is the in-tx variant of spaceRole, used by handlers that need
// the membership check inside an existing transaction.
func spaceRoleTx(ctx context.Context, tx *sql.Tx, userID, spaceID int64) (string, error) {
	var role string
	err := tx.QueryRowContext(ctx, effectiveRoleQuery, spaceID, userID).Scan(&role)
	return role, err
}

// requireMembership resolves the user's role in spaceID and writes the
// appropriate 401/403/500 envelope when access should be denied. Returns
// (role, true) on success; (_, false) means the response has been written and
// the caller must return immediately.
//
// When the request is bearer-authed AND the API key carries a space_id
// restriction, accessing any other space short-circuits to 403
// api_key_space_scope BEFORE the membership check — the underlying user might
// be a member of that other space, but the bearer scope is a strict ceiling.
func (s *Server) requireMembership(w http.ResponseWriter, r *http.Request, spaceID int64) (string, bool) {
	u, ok := requireUser(w, r)
	if !ok {
		return "", false
	}
	k, _ := auth.APIKeyFromContext(r.Context())
	role, ae := s.membershipCore(r.Context(), u, k, spaceID)
	if ae != nil {
		writeError(w, ae.Status, ae.Code, ae.Message)
		return "", false
	}
	return role, true
}

// membershipCore is the transport-agnostic core behind requireMembership: it
// resolves the caller's effective role on spaceID, enforcing the bearer
// space-scope ceiling first. Returns the role or an *apiErr (403
// api_key_space_scope / 403 forbidden / 500). Shared by the REST handlers and
// the MCP tools so the gating is identical across both surfaces. k may be nil
// (cookie-session callers); pass auth.APIKeyFromContext's result.
func (s *Server) membershipCore(ctx context.Context, u *auth.User, k *auth.APIKey, spaceID int64) (string, *apiErr) {
	if ae := apiKeySpaceScopeErr(k, spaceID); ae != nil {
		return "", ae
	}
	role, err := spaceRole(ctx, s.DB, u.ID, spaceID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", &apiErr{http.StatusForbidden, "forbidden", "not a member"}
	}
	if err != nil {
		return "", &apiErr{http.StatusInternalServerError, "internal", "lookup membership failed"}
	}
	return role, nil
}

// apiKeySpaceScopeErr is the ctx-form of enforceAPIKeySpaceScope: returns the
// api_key_space_scope *apiErr when a space-pinned bearer key targets a
// different space, else nil. k may be nil. Shared by the extracted cores.
func apiKeySpaceScopeErr(k *auth.APIKey, spaceID int64) *apiErr {
	if k == nil || k.SpaceID == nil {
		return nil
	}
	if *k.SpaceID != spaceID {
		return &apiErr{http.StatusForbidden, "api_key_space_scope", "api key is restricted to a different space"}
	}
	return nil
}

// enforceAPIKeySpaceScope writes a 403 api_key_space_scope envelope and
// returns false when the request is bearer-authed AND the API key has a
// space_id restriction that doesn't match spaceID. On all other paths
// (cookie session, no restriction, restriction matches) returns true without
// writing anything.
//
// Called from handler entry points that already know the target space — the
// page handlers resolve it from a path param or a parent lookup, then call
// this helper before any role check. Standalone from requireMembership so
// tx-shaped handlers (CreatePage, UpdatePage, DeletePage, MovePage) can
// gate inside their existing tx flow without re-running the membership
// query.
func enforceAPIKeySpaceScope(w http.ResponseWriter, r *http.Request, spaceID int64) bool {
	k, ok := auth.APIKeyFromContext(r.Context())
	if !ok || k.SpaceID == nil {
		return true
	}
	if *k.SpaceID != spaceID {
		writeError(w, http.StatusForbidden, "api_key_space_scope", "api key is restricted to a different space")
		return false
	}
	return true
}
