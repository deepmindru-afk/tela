// Phase C.1 (#123) write-side tool stubs. NOT REGISTERED on the server in
// M16.B.1; this file exists so C.1 has predictable filenames to fill in.
// Each export is a `null` so a casual `import` of any of these resolves but
// callers must guard the `null`. Keeping the names here so search hits land
// in one place.
//
//   create_page    → POST   /api/pages
//   update_page    → PATCH  /api/pages/{id}
//   delete_page    → DELETE /api/pages/{id}
//   add_comment    → POST   /api/pages/{id}/comments
//   import_markdown→ POST   /api/spaces/{id}/import  (multipart/form-data)

export const createPage = null;
export const updatePage = null;
export const deletePage = null;
export const addComment = null;
export const importMarkdown = null;
