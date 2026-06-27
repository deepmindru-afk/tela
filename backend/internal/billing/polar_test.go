package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strconv"
	"testing"
	"time"
)

// signWebhook builds a valid Standard Webhooks header set for body, matching
// VerifyWebhook's construction (raw secret as key, id.ts.body signed content).
func signWebhook(secret, id string, ts time.Time, body []byte) http.Header {
	tss := strconv.FormatInt(ts.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(id + "." + tss + "."))
	mac.Write(body)
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	h := http.Header{}
	h.Set("webhook-id", id)
	h.Set("webhook-timestamp", tss)
	h.Set("webhook-signature", "v1,"+sig)
	return h
}

func TestVerifyWebhook(t *testing.T) {
	const secret = "polar_whs_test_secret"
	body := []byte(`{"type":"subscription.active","data":{"id":"sub_1"}}`)
	now := time.Now()

	t.Run("valid", func(t *testing.T) {
		if err := VerifyWebhook(secret, signWebhook(secret, "msg_1", now, body), body); err != nil {
			t.Fatalf("valid signature rejected: %v", err)
		}
	})

	t.Run("rotation: extra signature in list", func(t *testing.T) {
		h := signWebhook(secret, "msg_1", now, body)
		h.Set("webhook-signature", "v1,deadbeef "+h.Get("webhook-signature"))
		if err := VerifyWebhook(secret, h, body); err != nil {
			t.Fatalf("should accept a match anywhere in the list: %v", err)
		}
	})

	t.Run("tampered body", func(t *testing.T) {
		h := signWebhook(secret, "msg_1", now, body)
		if err := VerifyWebhook(secret, h, []byte(`{"type":"evil"}`)); err == nil {
			t.Fatal("tampered body should fail verification")
		}
	})

	t.Run("wrong secret", func(t *testing.T) {
		h := signWebhook("other_secret", "msg_1", now, body)
		if err := VerifyWebhook(secret, h, body); err == nil {
			t.Fatal("wrong secret should fail verification")
		}
	})

	t.Run("stale timestamp", func(t *testing.T) {
		old := now.Add(-10 * time.Minute)
		if err := VerifyWebhook(secret, signWebhook(secret, "msg_1", old, body), body); err == nil {
			t.Fatal("timestamp outside tolerance should fail")
		}
	})

	t.Run("missing headers", func(t *testing.T) {
		if err := VerifyWebhook(secret, http.Header{}, body); err == nil {
			t.Fatal("missing headers should fail")
		}
	})
}

func TestProductMapping(t *testing.T) {
	cfg := Config{Products: parseProducts(" personal_plus:prod_a , org_team:prod_b ,bad,empty: ")}
	c := New(cfg)

	if id, ok := c.ProductFor("personal_plus"); !ok || id != "prod_a" {
		t.Fatalf("ProductFor(personal_plus) = %q,%v", id, ok)
	}
	if _, ok := c.ProductFor("personal_free"); ok {
		t.Fatal("free tier should have no product")
	}
	if plan, ok := c.PlanFor("prod_b"); !ok || plan != "org_team" {
		t.Fatalf("PlanFor(prod_b) = %q,%v", plan, ok)
	}
	if _, ok := c.PlanFor("prod_unknown"); ok {
		t.Fatal("unknown product should not reverse-map")
	}
	if len(cfg.Products) != 2 {
		t.Fatalf("malformed pairs should be skipped, got %v", cfg.Products)
	}
}

func TestEnabled(t *testing.T) {
	if New(Config{}).Enabled() {
		t.Fatal("zero config should be disabled")
	}
	if New(Config{Token: "t"}).Enabled() {
		t.Fatal("token without webhook secret should be disabled")
	}
	if !New(Config{Token: "t", WebhookSecret: "s"}).Enabled() {
		t.Fatal("token + secret should be enabled")
	}
}

func TestParseEvent(t *testing.T) {
	body := []byte(`{"type":"subscription.active","data":{
		"id":"sub_1","status":"active","product_id":"prod_a","customer_id":"cus_1",
		"cancel_at_period_end":false,"customer":{"external_id":"user:42"}}}`)
	e, err := ParseEvent(body)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if e.Type != "subscription.active" || e.Data.Customer.ExternalID != "user:42" || e.Data.ProductID != "prod_a" {
		t.Fatalf("unexpected parse: %+v", e)
	}
}
