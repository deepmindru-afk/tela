package api

import (
	"context"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/zcag/tela/backend/internal/auth"
)

// A live editor connected over ws must receive a tagReset frame when an agent
// rewrites the page body via MCP — so it can reload from the new pages.body
// instead of clobbering it with stale CRDT state.
func TestWS_AgentWriteResetsConnectedPeer(t *testing.T) {
	ts, d := newWSWiredServer(t)
	owner := seedUser(t, d, "owner", "ownerpw1", false)
	spaceID := seedSpace(t, d, "S", "s", owner)
	pageID := seedPage(t, d, spaceID, "P")

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cli := loginClient(t, ts, "owner", "ownerpw1")
	conn, _, err := websocket.Dial(ctx, wsURLFor(ts, pageID), &websocket.DialOptions{HTTPClient: cli})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.CloseNow()
	conn.SetReadLimit(wsReadLimit)

	// drain the server's sync-init
	_, frame, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("read sync-init: %v", err)
	}
	if len(frame) < 1 || frame[0] != tagSyncInit {
		t.Fatalf("first frame tag=%x, want sync-init", frame)
	}

	// agent rewrites the body via the real MCP tool
	sess := mcpSession(t, ctx, ts, seedReadKey(t, d, owner, auth.ScopeWrite))
	var up getPageOut
	mcpCallJSON(t, ctx, sess, "update_page", map[string]any{"id": pageID, "body": "agent rewrote this out of band"}, &up)
	if up.Page.Body != "agent rewrote this out of band" {
		t.Fatalf("body not updated: %q", up.Page.Body)
	}

	// the connected peer must be told to reset
	_, frame2, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("read after agent write: %v", err)
	}
	if len(frame2) < 1 || frame2[0] != tagReset {
		t.Fatalf("expected tagReset (0x06), got % x", frame2)
	}
}
