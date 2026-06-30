package api

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/zcag/tela/backend/internal/ee"
)

// TestLicenseAPI_RealKeyInstall — end-to-end with a REAL key: sign with the
// vendor private key (TELA_LICENSE_SIGNING_KEY), install it through the HTTP
// admin API (which verifies against the EMBEDDED public key), and confirm it
// activates and unlocks an ee feature. Skipped when the signing key isn't in the
// env (CI / contributors), since it's the production keypair.
func TestLicenseAPI_RealKeyInstall(t *testing.T) {
	keyB64 := os.Getenv("TELA_LICENSE_SIGNING_KEY")
	if keyB64 == "" {
		t.Skip("TELA_LICENSE_SIGNING_KEY not set — skipping real-key round-trip")
	}
	raw, err := base64.RawStdEncoding.DecodeString(keyB64)
	if err != nil || len(raw) != ed25519.PrivateKeySize {
		t.Fatalf("bad signing key in env")
	}
	token, err := ee.Sign(ed25519.PrivateKey(raw), ee.License{
		Customer: "RoundTrip Test", Tier: "enterprise", Seats: 10,
		Features: map[string]bool{"sso": true, "audit": true},
	})
	if err != nil {
		t.Fatal(err)
	}

	d := newAPITestDB(t)
	srv := New(d)
	adminID := seedUser(t, d, "admin", "adminpw123", true)
	org := seedOrg(t, d, "Free Co", "freeco") // org_free, no plan sso

	// Install the real key through the admin API.
	put := recordHandler(srv.PutLicense, userRequest(http.MethodPut, "/api/admin/license",
		`{"token":"`+token+`"}`, authUser(adminID, "admin", true)))
	if put.Code != http.StatusOK {
		t.Fatalf("install real key: want 200, got %d body=%q", put.Code, put.Body.String())
	}

	// GET shows it active with the granted features.
	get := recordHandler(srv.GetLicense, userRequest(http.MethodGet, "/api/admin/license", "", authUser(adminID, "admin", true)))
	var info struct {
		License ee.Status `json:"license"`
	}
	_ = json.Unmarshal(get.Body.Bytes(), &info)
	if !info.License.Valid || info.License.Customer != "RoundTrip Test" {
		t.Fatalf("license not active after install: %+v", info.License)
	}

	// And it unlocks an ee feature for a free-plan org via the license path.
	if !srv.entitled(context.Background(), account{accountOrg, org}, "sso") {
		t.Fatal("installed license should entitle sso on a free-plan org")
	}
}

// TestEntitledViaLicense — the two entitlement paths and, crucially, that the
// plan-flag path is NOT honoured on self-host (managedCloud=false here, the zero
// value): only a license key unlocks ee features there. On the managed cloud the
// plan flag is authoritative.
func TestEntitledViaLicense(t *testing.T) {
	d := newAPITestDB(t)
	s := &Server{DB: d} // managedCloud defaults false → self-host semantics
	ctx := context.Background()
	org := seedOrg(t, d, "Acme", "acme")
	acct := account{accountOrg, org}

	// Self-host, free plan, no license → not entitled.
	if s.entitled(ctx, acct, "sso") {
		t.Fatal("free org without a license must not be entitled to sso")
	}

	// A license granting sso entitles the org regardless of plan.
	s.license.Store(&ee.License{Tier: "enterprise", Features: map[string]bool{"sso": true}})
	if !s.entitled(ctx, acct, "sso") {
		t.Fatal("license granting sso should entitle the org")
	}
	if s.entitled(ctx, acct, "scim") {
		t.Fatal("license without scim must not entitle scim")
	}

	// Self-host bypass is CLOSED: assigning the Enterprise plan WITHOUT a license
	// must NOT unlock ee features (plan_key is admin-assignable on self-host).
	s.license.Store(nil)
	mustExec(t, d, `UPDATE orgs SET plan_key='org_enterprise' WHERE id=$1`, org)
	if s.entitled(ctx, acct, "sso") {
		t.Fatal("self-host: an Enterprise plan alone must NOT unlock sso (needs a license)")
	}

	// On the managed cloud the same plan flag IS authoritative.
	s.managedCloud = true
	if !s.entitled(ctx, acct, "sso") {
		t.Fatal("managed cloud: Enterprise plan should entitle sso via the plan flag")
	}
}

// TestLicenseAPI_AdminFlow — the admin endpoints are instance-admin gated, report
// no license cleanly, and reject a malformed key up front.
func TestLicenseAPI_AdminFlow(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d)
	adminID := seedUser(t, d, "admin", "adminpw123", true)
	userID := seedUser(t, d, "bob", "bobpw12345", false)

	// Non-admin is rejected.
	if rec := recordHandler(srv.GetLicense, userRequest(http.MethodGet, "/api/admin/license", "", authUser(userID, "bob", false))); rec.Code == http.StatusOK {
		t.Fatalf("non-admin GET license should be rejected, got %d", rec.Code)
	}

	// Admin GET with no license installed → valid:false.
	rec := recordHandler(srv.GetLicense, userRequest(http.MethodGet, "/api/admin/license", "", authUser(adminID, "admin", true)))
	if rec.Code != http.StatusOK {
		t.Fatalf("admin GET license: status=%d body=%q", rec.Code, rec.Body.String())
	}
	var got struct {
		License ee.Status `json:"license"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.License.Valid {
		t.Fatal("no license installed should report valid:false")
	}

	// A malformed key is rejected before persistence.
	put := recordHandler(srv.PutLicense, userRequest(http.MethodPut, "/api/admin/license", `{"token":"not-a-real-key"}`, authUser(adminID, "admin", true)))
	if put.Code != http.StatusBadRequest {
		t.Fatalf("malformed license PUT: want 400, got %d body=%q", put.Code, put.Body.String())
	}
}
