package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"
)

// TestPublishGate_EntitlementOptIn covers the cloud publish-gating posture:
//   - default (setting off): any owner can publish, regardless of plan;
//   - setting on + free plan (no publishing feature): blocked with 402;
//   - setting on + unlimited/comp plan (publishing=true): allowed.
//
// This mirrors the self-hoster vs cloud split: a self-host instance leaves the
// gate off so publishing always works; the cloud turns it on and the default
// free tier must upgrade, while a comp tier (publishing=true) still publishes.
func TestPublishGate_EntitlementOptIn(t *testing.T) {
	ts, d, srv := newWiredServerOnDiskWithSrv(t)
	ctx := context.Background()

	owner := seedUser(t, d, "pub", "pubpw12345", false)
	c := loginClient(t, ts, "pub", "pubpw12345")

	publish := func(spaceID int64) int {
		r, err := patchJSON(c, fmt.Sprintf("%s/api/spaces/%d", ts.URL, spaceID), `{"visibility":"public"}`)
		if err != nil {
			t.Fatalf("patch: %v", err)
		}
		defer r.Body.Close()
		_, _ = io.ReadAll(r.Body)
		return r.StatusCode
	}

	// One personal space (a user may own only one) carries the whole flow; the
	// gate keys off the owner's plan, so we toggle that between attempts.
	space := seedPersonalSpace(t, d, "Pub Blog", "pub-blog", owner)

	// --- Gate OFF (default): free-plan owner can publish. ---
	if st := publish(space); st != http.StatusOK {
		t.Fatalf("gate off: publish status=%d want 200", st)
	}
	// Reset to private for the gated attempts.
	if _, err := d.ExecContext(ctx, `UPDATE spaces SET visibility = 'private' WHERE id = $1`, space); err != nil {
		t.Fatalf("reset private: %v", err)
	}

	// --- Turn the gate ON (cloud posture). ---
	if err := srv.settings.Set(ctx, "require_publishing_entitlement", "true", nil); err != nil {
		t.Fatalf("set gate: %v", err)
	}

	// Unentitled: default plan is personal_free, which has no publishing feature.
	if st := publish(space); st != http.StatusPaymentRequired {
		t.Fatalf("gate on + free plan: publish status=%d want 402", st)
	}

	// Entitled: bump the owner to the comp/unlimited tier (publishing=true).
	setPlan(t, d, accountUser, owner, "personal_unlimited")
	if st := publish(space); st != http.StatusOK {
		t.Fatalf("gate on + unlimited plan: publish status=%d want 200", st)
	}

	// Un-publishing is never gated, even with the gate on and a free plan again.
	setPlan(t, d, accountUser, owner, "personal_free")
	if r, _ := patchJSON(c, fmt.Sprintf("%s/api/spaces/%d", ts.URL, space), `{"visibility":"private"}`); r.StatusCode != http.StatusOK {
		t.Fatalf("un-publish should never be gated, got status=%d", r.StatusCode)
	}
}
