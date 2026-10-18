package api

// Update check: tells a self-hosted instance's admins when a newer tela release
// is out. Once a day it asks updates.telawiki.com for the latest release; the
// answer lives in memory and is shown in Settings > Instance and as an item in
// the admin's account menu.
//
// What it sends, and the promise the docs make about it (keep them in step): the
// version this instance runs, and nothing else (no instance id, hostname, user
// or page counts). telawiki.com counts how many instances check in, per version,
// without keeping their IP addresses. On by default; an admin turns it off in
// Settings > Instance (updates.check = "off"), and TELA_UPDATE_CHECK=0 turns it
// off for good (the toggle then shows as locked). Never runs on the managed
// cloud or a dev build.

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	updateCheckSettingKey = "updates.check"
	updateCheckEvery      = 24 * time.Hour
	updateCheckTick       = time.Hour
)

// latestReleaseURL is a var so tests can point it at a fake.
var latestReleaseURL = "https://updates.telawiki.com/v1/latest"

// updateStatus is the last check's outcome.
type updateStatus struct {
	Latest      string    // "0.11.0", no leading v
	ReleaseURL  string    // the GitHub release page
	PublishedAt string    // RFC3339
	CheckedAt   time.Time // zero = never checked
	Err         string    // last failure, "" when the last check worked
}

type updateChecker struct {
	mu   sync.Mutex
	last updateStatus
}

func (u *updateChecker) get() updateStatus {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.last
}

func (u *updateChecker) set(st updateStatus) {
	u.mu.Lock()
	u.last = st
	u.mu.Unlock()
}

// updateCheckEnvOff reports whether TELA_UPDATE_CHECK turns the check off.
func updateCheckEnvOff() bool {
	v := strings.TrimSpace(os.Getenv("TELA_UPDATE_CHECK"))
	return v == "0" || strings.EqualFold(v, "false") || strings.EqualFold(v, "off")
}

// updateCheckApplies: only a self-hosted, released build has something to compare.
func (s *Server) updateCheckApplies() bool {
	_, ok := parseSemver(Version)
	return ok && !s.managedCloud
}

func (s *Server) updateCheckEnabled() bool {
	if updateCheckEnvOff() || !s.updateCheckApplies() {
		return false
	}
	v, _ := s.settings.Get(updateCheckSettingKey)
	return v != "off"
}

// updateCheckLoop checks at boot, then whenever the last check is a day old. The
// hourly tick (not a 24h ticker) means re-enabling the check acts within the hour.
// Started only where updateCheckApplies.
func (s *Server) updateCheckLoop(ctx context.Context) {
	t := time.NewTicker(updateCheckTick)
	defer t.Stop()
	for {
		if s.updateCheckEnabled() && time.Since(s.updates.get().CheckedAt) >= updateCheckEvery {
			s.checkForUpdate(ctx)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// checkForUpdate fetches the latest release and records the outcome. A failure
// (offline, air-gapped, rate-limited) is recorded, not logged loudly: it only
// means no notice. The last good answer survives a failed check.
func (s *Server) checkForUpdate(ctx context.Context) {
	prev := s.updates.get()
	st := updateStatus{CheckedAt: time.Now().UTC()}
	if err := fetchLatestRelease(ctx, &st); err != nil {
		st.Err = err.Error()
		st.Latest, st.ReleaseURL, st.PublishedAt = prev.Latest, prev.ReleaseURL, prev.PublishedAt
		slog.Debug("update check failed", "err", err)
	}
	s.updates.set(st)
}

func fetchLatestRelease(ctx context.Context, st *updateStatus) error {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		latestReleaseURL+"?version="+url.QueryEscape(strings.TrimPrefix(Version, "v")), nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("release lookup returned HTTP %d", resp.StatusCode)
	}
	var rel struct {
		Latest      string `json:"latest"`
		ReleaseURL  string `json:"release_url"`
		PublishedAt string `json:"published_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return err
	}
	if _, ok := parseSemver(rel.Latest); !ok {
		return fmt.Errorf("unexpected latest version %q", rel.Latest)
	}
	st.Latest = strings.TrimPrefix(rel.Latest, "v")
	st.ReleaseURL, st.PublishedAt = rel.ReleaseURL, rel.PublishedAt
	return nil
}

// parseSemver reads "v1.2.3" or "1.2.3" (a -suffix is ignored). ok=false for
// anything else, including the "dev" of an untagged build.
func parseSemver(v string) ([3]int, bool) {
	var out [3]int
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		v = v[:i]
	}
	parts := strings.Split(v, ".")
	if len(parts) != 3 {
		return out, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}

// newerVersion reports whether latest is a higher release than current.
func newerVersion(latest, current string) bool {
	l, ok1 := parseSemver(latest)
	c, ok2 := parseSemver(current)
	if !ok1 || !ok2 {
		return false
	}
	for i := range l {
		if l[i] != c[i] {
			return l[i] > c[i]
		}
	}
	return false
}

// availableUpdate is the newer version to tell admins about, "" when there is
// none or the check is off (turning it off also silences an old notice).
func (s *Server) availableUpdate() string {
	if !s.updateCheckEnabled() {
		return ""
	}
	if l := s.updates.get().Latest; newerVersion(l, Version) {
		return l
	}
	return ""
}

type updateStatusDTO struct {
	Applies         bool   `json:"applies"` // false on the cloud or a dev build: no section at all
	Enabled         bool   `json:"enabled"`
	EnvLocked       bool   `json:"env_locked"` // TELA_UPDATE_CHECK=0: the toggle can't turn it on
	Current         string `json:"current"`
	Latest          string `json:"latest,omitempty"`
	ReleaseURL      string `json:"release_url,omitempty"`
	PublishedAt     string `json:"published_at,omitempty"`
	CheckedAt       string `json:"checked_at,omitempty"`
	Error           string `json:"error,omitempty"`
	UpdateAvailable bool   `json:"update_available"`
}

func (s *Server) updateStatusDTO() updateStatusDTO {
	st := s.updates.get()
	d := updateStatusDTO{
		Applies:         s.updateCheckApplies(),
		Enabled:         s.updateCheckEnabled(),
		EnvLocked:       updateCheckEnvOff(),
		Current:         strings.TrimPrefix(Version, "v"),
		Latest:          st.Latest,
		ReleaseURL:      st.ReleaseURL,
		PublishedAt:     st.PublishedAt,
		Error:           st.Err,
		UpdateAvailable: s.availableUpdate() != "",
	}
	if !st.CheckedAt.IsZero() {
		d.CheckedAt = st.CheckedAt.Format("2006-01-02 15:04:05") // UTC, the wire format everywhere else
	}
	return d
}

// GetUpdateStatus handles GET /api/admin/updates.
func (s *Server) GetUpdateStatus(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireInstanceAdmin(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, s.updateStatusDTO())
}

// CheckForUpdate handles POST /api/admin/updates/check: "Check now", and the
// check the panel runs right after an admin turns it back on.
func (s *Server) CheckForUpdate(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireInstanceAdmin(w, r); !ok {
		return
	}
	if !s.updateCheckEnabled() {
		writeError(w, http.StatusConflict, "update_check_off", "the update check is turned off")
		return
	}
	s.checkForUpdate(r.Context())
	writeJSON(w, http.StatusOK, s.updateStatusDTO())
}
