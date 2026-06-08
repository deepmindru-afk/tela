package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
)

// TestPublicDiscover_OnlyPublic seeds a public + a private space and asserts the
// cross-tenant /api/public/discover directory lists ONLY the public one, with
// owner handle + page count, and never leaks the private space.
func TestPublicDiscover_OnlyPublic(t *testing.T) {
	ts, d := newWiredServer(t)
	alice := seedUser(t, d, "alice", "alicepw12", false)
	bob := seedUser(t, d, "bob", "bobpw1234", false)

	pub := seedSpace(t, d, "Alice Blog", "alice-blog", alice)
	priv := seedSpace(t, d, "Bob Secret", "bob-secret", bob)

	// Two live pages in the public space (page_count signal), one in the private.
	for i := 0; i < 2; i++ {
		if _, err := d.ExecContext(context.Background(),
			`INSERT INTO pages (space_id, parent_id, title, body, position) VALUES ($1, NULL, $2, 'b', $3)`,
			pub, fmt.Sprintf("P%d", i), i); err != nil {
			t.Fatalf("seed pub page: %v", err)
		}
	}
	if _, err := d.ExecContext(context.Background(),
		`INSERT INTO pages (space_id, parent_id, title, body, position) VALUES ($1, NULL, 'Hidden', 'x', 0)`,
		priv); err != nil {
		t.Fatalf("seed priv page: %v", err)
	}

	// Flip only the public space public.
	if _, err := d.ExecContext(context.Background(),
		`UPDATE spaces SET visibility = 'public' WHERE id = $1`, pub); err != nil {
		t.Fatalf("set public: %v", err)
	}

	resp, err := http.Get(ts.URL + "/api/public/discover")
	if err != nil {
		t.Fatalf("GET discover: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("discover status=%d body=%s", resp.StatusCode, b)
	}
	var out struct {
		Spaces []struct {
			ID          int64  `json:"id"`
			Name        string `json:"name"`
			Slug        string `json:"slug"`
			OwnerHandle string `json:"owner_handle"`
			PageCount   int64  `json:"page_count"`
			UpdatedAt   string `json:"updated_at"`
		} `json:"spaces"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out.Spaces) != 1 {
		t.Fatalf("discover returned %d spaces, want 1 (public only): %+v", len(out.Spaces), out.Spaces)
	}
	got := out.Spaces[0]
	if got.ID != pub {
		t.Fatalf("discover space id=%d want %d (the public one)", got.ID, pub)
	}
	if got.OwnerHandle != "alice" {
		t.Fatalf("owner handle=%q want alice", got.OwnerHandle)
	}
	if got.PageCount != 2 {
		t.Fatalf("page_count=%d want 2", got.PageCount)
	}
	if got.UpdatedAt == "" {
		t.Fatalf("expected a recency signal (updated_at), got empty")
	}
	// The private space must never surface.
	for _, sp := range out.Spaces {
		if sp.ID == priv {
			t.Fatalf("private space %d leaked into discover", priv)
		}
	}
}

// TestPublicDiscover_Sort verifies the popular sort ranks higher page counts
// first across public spaces.
func TestPublicDiscover_Sort(t *testing.T) {
	ts, d := newWiredServer(t)
	u := seedUser(t, d, "auth", "authpw1234", false)
	few := seedSpace(t, d, "Few", "few", u)
	many := seedSpace(t, d, "Many", "many", u)
	for _, sp := range []int64{few, many} {
		if _, err := d.ExecContext(context.Background(),
			`UPDATE spaces SET visibility = 'public' WHERE id = $1`, sp); err != nil {
			t.Fatalf("publish: %v", err)
		}
	}
	mk := func(sp int64, n int) {
		for i := 0; i < n; i++ {
			if _, err := d.ExecContext(context.Background(),
				`INSERT INTO pages (space_id, parent_id, title, body, position) VALUES ($1, NULL, $2, 'b', $3)`,
				sp, fmt.Sprintf("p%d", i), i); err != nil {
				t.Fatalf("seed page: %v", err)
			}
		}
	}
	mk(few, 1)
	mk(many, 3)

	resp, err := http.Get(ts.URL + "/api/public/discover?sort=popular")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	var out struct {
		Spaces []struct {
			ID        int64 `json:"id"`
			PageCount int64 `json:"page_count"`
		} `json:"spaces"`
	}
	json.NewDecoder(resp.Body).Decode(&out)
	if len(out.Spaces) != 2 {
		t.Fatalf("want 2 spaces, got %d", len(out.Spaces))
	}
	if out.Spaces[0].ID != many {
		t.Fatalf("popular sort: first=%d want many=%d (page counts %d,%d)",
			out.Spaces[0].ID, many, out.Spaces[0].PageCount, out.Spaces[1].PageCount)
	}
}
