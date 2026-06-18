-- 0045_heal_stranded_space_files.sql — realign files to their page's space.
--
-- Cross-space page moves historically updated pages.space_id but left the page's
-- space_files keyed to the OLD space (applyMoveTx had no UPDATE space_files).
-- Such files showed dead URLs in list_attachments, counted against the old
-- space's quota, surfaced in the wrong /dav tree, and would be lost if the old
-- space were deleted (space_files ON DELETE CASCADE). Realign every page-parented
-- file to its owning page's space.
--
-- applyMoveTx now carries files along on a move, so this is a one-off heal. Body
-- embeds that still hard-code the old space keep working: ServeSpaceFile serves
-- by content hash regardless of the space in the URL. Space-root files
-- (parent_page_id IS NULL) can't be stranded by a page move and are left as-is.
-- No deleted_at filter so trashed/recoverable files realign too; the location
-- unique index is partial on deleted_at IS NULL and a file's (space, page, name)
-- stays unique in the target space, so no collision.
UPDATE space_files sf
   SET space_id = p.space_id, updated_at = tela_now()
  FROM pages p
 WHERE sf.parent_page_id = p.id
   AND sf.space_id <> p.space_id;
