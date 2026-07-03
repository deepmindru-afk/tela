package api

import (
	"context"
	"strings"
	"testing"
)

// A sheet's body is Defter markdown: compact GFM tables + a fenced defter-style
// block. It is a verbatim-body doc-type (like a deck) — its content must survive
// ingress byte-for-byte, never run through the prose strip/normalize path that
// would pad tables or eat the style block. Formulas and the style fence stay put.
func TestSheetBodyPreservedVerbatim(t *testing.T) {
	d := newAPITestDB(t)
	srv := New(d)
	ctx := context.Background()
	u := seedUser(t, d, "sheetie", "sheetpw123", false)
	sp := seedSpace(t, d, "Sheets", "sheets", u)
	au := authUser(u, "sheetie", false)

	sheetBody := "## Sheet: Budget\n\n" +
		"| Item | Qty | Unit | Total |\n|---|---|---|---|\n" +
		"| Widget | 3 | 4.00 | =B2*C2 |\n| **Total** |  |  | =SUM(D2:D2) |\n\n" +
		"```defter-style\nA1:D1  bold fill=surface-2 align=center\nD2:D3  format=#,##0.00\n```\n"

	// Create: body kept verbatim, sheet prop stamped.
	p, ae := srv.createPageCore(ctx, au, nil, pageCreateRequest{
		SpaceID: sp, Title: "My Sheet", Body: sheetBody, Props: map[string]any{"sheet": true},
	}, true)
	if ae != nil {
		t.Fatalf("create sheet: %v", ae)
	}
	if p.Body != sheetBody {
		t.Fatalf("sheet body not verbatim on create:\nwant:\n%s\ngot:\n%s", sheetBody, p.Body)
	}
	if b, _ := p.Props["sheet"].(bool); !b {
		t.Fatalf("sheet prop not set: %+v", p.Props)
	}

	// Update (body-only, props not carried): still verbatim via pageIsSheetTx.
	next := strings.Replace(sheetBody, "Widget | 3", "Widget | 5", 1)
	up, ae := srv.updatePageCore(ctx, au, nil, p.ID, pageUpdateRequest{Body: &next}, true)
	if ae != nil {
		t.Fatalf("update sheet: %v", ae)
	}
	if up.Body != next {
		t.Fatalf("sheet body not verbatim on body-only update:\nwant:\n%s\ngot:\n%s", next, up.Body)
	}
}
